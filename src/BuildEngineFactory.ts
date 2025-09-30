/**
 * @license
 * Copyright (c) 2025 Handsoncode. All rights reserved.
 */

import {ArraySizePredictor} from './ArraySize'
import {CellContentParser} from './CellContentParser'
import {ClipboardOperations} from './ClipboardOperations'
import {Config} from './Config'
import {CrudOperations} from './CrudOperations'
import {DateTimeHelper} from './DateTimeHelper'
import {DependencyGraph} from './DependencyGraph'
import {SheetSizeLimitExceededError} from './errors'
import {Evaluator} from './Evaluator'
import {Exporter} from './Exporter'
import {GraphBuilder} from './GraphBuilder'
import {UIElement} from './i18n'
import {ArithmeticHelper} from './interpreter/ArithmeticHelper'
import {FunctionRegistry} from './interpreter/FunctionRegistry'
import {Interpreter} from './interpreter/Interpreter'
import {LazilyTransformingAstService} from './LazilyTransformingAstService'
import {buildColumnSearchStrategy, ColumnSearchStrategy} from './Lookup/SearchStrategy'
import {NamedExpressions} from './NamedExpressions'
import {NumberLiteralHelper} from './NumberLiteralHelper'
import {Operations} from './Operations'
import {buildLexerConfig, ParserWithCaching, Unparser} from './parser'
import {Serialization, SerializedNamedExpression} from './Serialization'
import {findBoundaries, Sheet, Sheets, validateAsSheet} from './Sheet'
import {EmptyStatistics, Statistics, StatType} from './statistics'
import {UndoRedo} from './UndoRedo'
import {ConfigParams} from './ConfigParams'

export type EngineState = {
  config: Config,
  stats: Statistics,
  dependencyGraph: DependencyGraph,
  columnSearch: ColumnSearchStrategy,
  parser: ParserWithCaching,
  unparser: Unparser,
  cellContentParser: CellContentParser,
  evaluator: Evaluator,
  lazilyTransformingAstService: LazilyTransformingAstService,
  crudOperations: CrudOperations,
  exporter: Exporter,
  namedExpressions: NamedExpressions,
  serialization: Serialization,
  functionRegistry: FunctionRegistry,
}

/**
 * Factory class for building HyperFormula engine instances with various configurations.
 * Provides static methods to create engines from sheets, single sheet, or empty configurations.
 * @category Core
 */
export class BuildEngineFactory {
  /**
   * Creates an engine instance from multiple sheets with optional configuration and named expressions.
   * Uses initialComputedValues from config for circular dependency resolution.
   * @param {Sheets} sheets - The sheets to build the engine from
   * @param {Partial<ConfigParams>} configInput - Optional configuration parameters
   * @param {SerializedNamedExpression[]} namedExpressions - Optional serialized named expressions
   * @returns {EngineState} The constructed engine state
   * @category Factory Methods
   */
  public static buildFromSheets(sheets: Sheets, configInput: Partial<ConfigParams> = {}, namedExpressions: SerializedNamedExpression[] = []): EngineState {
    const config = new Config(configInput)
    return this.buildEngine(config, sheets, namedExpressions, undefined)
  }

  /**
   * Creates an engine instance from a single sheet with optional configuration and named expressions.
   * Maps initialComputedValues to match the generated sheet name for circular dependency resolution.
   * @param {Sheet} sheet - The sheet to build the engine from
   * @param {Partial<ConfigParams>} configInput - Optional configuration parameters
   * @param {SerializedNamedExpression[]} namedExpressions - Optional serialized named expressions
   * @returns {EngineState} The constructed engine state
   * @category Factory Methods
   */
  public static buildFromSheet(sheet: Sheet, configInput: Partial<ConfigParams> = {}, namedExpressions: SerializedNamedExpression[] = []): EngineState {
    const config = new Config(configInput)
    const newsheetprefix = config.translationPackage.getUITranslation(UIElement.NEW_SHEET_PREFIX) + '1'
    const sheets = {[newsheetprefix]: sheet}
    
    if (config.initialComputedValues) {
      const firstSheetName = Object.keys(config.initialComputedValues)[0]
      if (firstSheetName) {
        config['initialComputedValues'] = {[newsheetprefix]: config.initialComputedValues[firstSheetName]}
      }
    }
    
    return this.buildEngine(config, sheets, namedExpressions, undefined)
  }

  /**
   * Creates an empty engine instance with optional configuration and named expressions.
   * @param {Partial<ConfigParams>} configInput - Optional configuration parameters
   * @param {SerializedNamedExpression[]} namedExpressions - Optional serialized named expressions
   * @returns {EngineState} The constructed engine state
   * @category Factory Methods
   */
  public static buildEmpty(configInput: Partial<ConfigParams> = {}, namedExpressions: SerializedNamedExpression[] = []): EngineState {
    const config = new Config(configInput)
    return this.buildEngine(config, {}, namedExpressions, undefined)
  }

  /**
   * Rebuilds an engine instance with existing configuration, sheets, named expressions, and statistics.
   * @param {Config} config - The configuration object
   * @param {Sheets} sheets - The sheets to build the engine from
   * @param {SerializedNamedExpression[]} namedExpressions - Serialized named expressions
   * @param {Statistics} stats - Existing statistics object
   * @returns {EngineState} The constructed engine state
   * @category Factory Methods
   */
  public static rebuildWithConfig(config: Config, sheets: Sheets, namedExpressions: SerializedNamedExpression[], stats: Statistics): EngineState {
    return this.buildEngine(config, sheets, namedExpressions, stats)
  }

  /**
   * Core engine building method that handles the construction of the engine state.
   * @param {Config} config - The configuration object
   * @param {Sheets} sheets - The sheets to build the engine from
   * @param {SerializedNamedExpression[]} inputNamedExpressions - Named expressions to add
   * @param {Statistics} stats - Statistics tracking object
   * @returns {EngineState} The constructed engine state
   * @private
   */
  private static buildEngine(
    config: Config, 
    sheets: Sheets = {}, 
    inputNamedExpressions: SerializedNamedExpression[] = [], 
    stats: Statistics = config.useStats ? new Statistics() : new EmptyStatistics(),
  ): EngineState {
    stats.start(StatType.BUILD_ENGINE_TOTAL)

    const namedExpressions = new NamedExpressions()
    const functionRegistry = new FunctionRegistry(config)
    const lazilyTransformingAstService = new LazilyTransformingAstService(stats)
    const dependencyGraph = DependencyGraph.buildEmpty(lazilyTransformingAstService, config, functionRegistry, namedExpressions, stats)
    const columnSearch = buildColumnSearchStrategy(dependencyGraph, config, stats)
    const sheetMapping = dependencyGraph.sheetMapping
    const addressMapping = dependencyGraph.addressMapping

    for (const sheetName in sheets) {
      if (Object.prototype.hasOwnProperty.call(sheets, sheetName)) {
        const sheet = sheets[sheetName]
        validateAsSheet(sheet)
        const boundaries = findBoundaries(sheet)
        if (boundaries.height > config.maxRows || boundaries.width > config.maxColumns) {
          throw new SheetSizeLimitExceededError()
        }
        const sheetId = sheetMapping.addSheet(sheetName)
        addressMapping.autoAddSheet(sheetId, boundaries)
      }
    }

    const parser = new ParserWithCaching(config, functionRegistry, sheetMapping.get)
    lazilyTransformingAstService.parser = parser
    const unparser = new Unparser(config, buildLexerConfig(config), sheetMapping.fetchDisplayName, namedExpressions)
    const dateTimeHelper = new DateTimeHelper(config)
    const numberLiteralHelper = new NumberLiteralHelper(config)
    const arithmeticHelper = new ArithmeticHelper(config, dateTimeHelper, numberLiteralHelper)
    const cellContentParser = new CellContentParser(config, dateTimeHelper, numberLiteralHelper)

    const arraySizePredictor = new ArraySizePredictor(config, functionRegistry)
    const operations = new Operations(config, dependencyGraph, columnSearch, cellContentParser, parser, stats, lazilyTransformingAstService, namedExpressions, arraySizePredictor)
    const undoRedo = new UndoRedo(config, operations)
    lazilyTransformingAstService.undoRedo = undoRedo
    const clipboardOperations = new ClipboardOperations(config, dependencyGraph, operations)
    const crudOperations = new CrudOperations(config, operations, undoRedo, clipboardOperations, dependencyGraph, columnSearch, parser, cellContentParser, lazilyTransformingAstService, namedExpressions)

    const exporter = new Exporter(config, namedExpressions, sheetMapping.fetchDisplayName, lazilyTransformingAstService)
    const serialization = new Serialization(dependencyGraph, unparser, exporter)

    const interpreter = new Interpreter(config, dependencyGraph, columnSearch, stats, arithmeticHelper, functionRegistry, namedExpressions, serialization, arraySizePredictor, dateTimeHelper)

    stats.measure(StatType.GRAPH_BUILD, () => {
      const graphBuilder = new GraphBuilder(dependencyGraph, columnSearch, parser, cellContentParser, stats, arraySizePredictor)
      graphBuilder.buildGraph(sheets, stats)
    })

    inputNamedExpressions.forEach((entry: SerializedNamedExpression) => {
      crudOperations.ensureItIsPossibleToAddNamedExpression(entry.name, entry.expression, entry.scope)
      crudOperations.operations.addNamedExpression(entry.name, entry.expression, entry.scope, entry.options)
    })

    const evaluator = new Evaluator(config, stats, interpreter, lazilyTransformingAstService, dependencyGraph, columnSearch)
    evaluator.run()

    stats.end(StatType.BUILD_ENGINE_TOTAL)

    return {
      config,
      stats,
      dependencyGraph,
      columnSearch,
      parser,
      unparser,
      cellContentParser,
      evaluator,
      lazilyTransformingAstService,
      crudOperations,
      exporter,
      namedExpressions,
      serialization,
      functionRegistry,
    }
  }
}
