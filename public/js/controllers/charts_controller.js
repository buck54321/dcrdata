import { Controller } from 'stimulus'
import { map, assign, merge } from 'lodash-es'
import Zoom from '../helpers/zoom_helper'
import { darkEnabled } from '../services/theme_service'
import { animationFrame } from '../helpers/animation_helper'
import { getDefault } from '../helpers/module_helper'
import axios from 'axios'
import TurboQuery from '../helpers/turbolinks_helper'
import globalEventBus from '../services/event_bus_service'
import { isEqual } from '../helpers/chart_helper'
import dompurify from 'dompurify'

var selectedChart
let Dygraph // lazy loaded on connect

const aDay = 86400 * 1000 // in milliseconds
const aMonth = 30 // in days
const atomsToDCR = 1e-8
const chartsToHideBin = ['ticket-price', 'pow-difficulty', 'missed-votes']
const chartsToHideScale = ['ticket-price']
const chartsToHideAll = ['duration-btw-blocks']
// index 0 represents y1 and 1 represents y2 axes.
const yValueRanges = { 'ticket-price': [1] }
const altXLabel = { 'duration-btw-blocks': 'Duration Between Blocks (Seconds)' }
const chartsToShowVisibility = {
  'ticket-price': { 'option1': 'Price', 'option2': 'Tickets Bought' },
  'duration-btw-blocks': { 'option1': 'Actual Count', 'option2': 'Expected Count' }
}
var ticketPoolSizeTarget, premine, stakeValHeight, stakeShare, sum
var baseSubsidy, subsidyInterval, subsidyExponent, windowSize, avgBlockTime
var rawCoinSupply, rawPoolValue

var isBinDisabled = (chart) => chartsToHideBin.indexOf(chart) > -1
var isScaleDisabled = (chart) => chartsToHideScale.indexOf(chart) > -1
var isAllControlsDisabled = (chart) => chartsToHideAll.indexOf(chart) > -1
var customXLabel = (chart) => altXLabel[chart] || ''
var intComma = (amount) => amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
var VisibilityLabels = (chart) => chartsToShowVisibility[chart] || null

function axesToRestoreYRange (chartName, origYRange, newYRange) {
  let axesIndexes = yValueRanges[chartName]
  if (!Array.isArray(origYRange) || !Array.isArray(newYRange) ||
    origYRange.length !== newYRange.length || !axesIndexes) return

  var axes
  for (var i = 0; i < axesIndexes.length; i++) {
    let index = axesIndexes[i]
    if (newYRange.length <= index) continue
    if (!isEqual(origYRange[index], newYRange[index])) {
      if (!axes) axes = {}
      if (index === 0) {
        axes = Object.assign(axes, { y1: { valueRange: origYRange[index] } })
      } else if (index === 1) {
        axes = Object.assign(axes, { y2: { valueRange: origYRange[index] } })
      }
    }
  }
  return axes
}

function formatHashRate (value, displayType) {
  value = parseInt(value)
  if (value <= 0) return value
  var shortUnits = ['Th', 'Ph', 'Eh']
  var labelUnits = ['terahash/s', 'petahash/s', 'exahash/s']
  for (var i = 0; i < labelUnits.length; i++) {
    var quo = Math.pow(1000, i)
    var max = Math.pow(1000, i + 1)
    if ((value > quo && value <= max) || i + 1 === labelUnits.length) {
      var data = intComma(Math.floor(value / quo))
      if (displayType === 'axis') return data + '' + shortUnits[i]
      return data + ' ' + labelUnits[i]
    }
  }
}

function blockReward (height) {
  if (height >= stakeValHeight) return baseSubsidy * Math.pow(subsidyExponent, Math.floor(height / subsidyInterval))
  if (height > 1) return baseSubsidy * (1 - stakeShare)
  if (height === 1) return premine
  return 0
}

function legendFormatter (data) {
  var html = ''
  if (data.x == null) {
    let dashLabels = data.series.reduce((nodes, series) => {
      return `${nodes} <div class="pr-2">${series.dashHTML} ${series.labelHTML}</div>`
    }, '')
    html = `<div class="d-flex flex-wrap justify-content-center align-items-center">
              <div class="pr-3">${this.getLabels()[0]}: N/A</div>
              <div class="d-flex flex-wrap">${dashLabels}</div>
            </div>`
  } else {
    var i = data.dygraph.getOption('legendIndex')
    var extraHTML = ''
    // The circulation chart has an additional legend entry showing percent
    // difference.
    if (data.series.length === 2 && data.series[0].label.toLowerCase().includes('coin supply')) {
      let inflation = data.dygraph.getOption('inflation')
      if (i < inflation.length) {
        let actual = data.series[0].y
        let predicted = inflation[i]
        let unminted = predicted - actual
        let change = ((unminted / predicted) * 100).toFixed(2)
        extraHTML = `<div class="pr-2">&nbsp;&nbsp;Unminted: ${intComma(unminted)} DCR (${change}%)</div>`
      }
    }

    let yVals = data.series.reduce((nodes, series) => {
      if (!series.isVisible) return nodes
      let yVal = series.yHTML
      switch (series.label.toLowerCase()) {
        case 'ticket pool value':
        case 'inflation limit':
        case 'coin supply':
          yVal = intComma(series.y) + ' DCR'
          break

        case 'total fee':
        case 'ticket price':
          yVal = series.y + ' DCR'
          break

        case 'hashrate':
          yVal = formatHashRate(series.y)
          break

        case 'stake participation':
          yVal = (Math.floor(series.y) / 1e4) + '%'
          break

        case 'actual count':
          yVal = series.y + ' (' + ((series.y * 100) / sum).toFixed(2) + '%)'
          break

        case 'expected count':
          yVal = series.y + ' (' + ((series.y * 100) / sum).toFixed(2) + '%)'
          break
      }
      let result = `${nodes} <div class="pr-2">${series.dashHTML} ${series.labelHTML}: ${yVal}</div>`

      if (series.label.toLowerCase() === 'stake participation' && rawCoinSupply.length === rawPoolValue.length &&
          rawPoolValue.length !== 0 && i !== null) {
        result += `<div class="pr-2"><div class="dygraph-legend-line"></div> Ticket Pool Value: ${intComma(rawPoolValue[i])} DCR</div>
          <div class="pr-2"><div class="dygraph-legend-line"></div> Coin Supply: ${intComma(rawCoinSupply[i])} DCR</div>`
      }

      return result
    }, '')

    html = `<div class="d-flex flex-wrap justify-content-center align-items-center">
                <div class="pr-3">${this.getLabels()[0]}: ${data.xHTML}</div>
                <div class="d-flex flex-wrap"> ${yVals}</div>
            </div>${extraHTML}`
  }

  dompurify.sanitize(html)
  return html
}

function nightModeOptions (nightModeOn) {
  if (nightModeOn) {
    return {
      rangeSelectorAlpha: 0.3,
      gridLineColor: '#596D81',
      colors: ['#2DD8A3', '#2970FF', '#FFC84E']
    }
  }
  return {
    rangeSelectorAlpha: 0.4,
    gridLineColor: '#C4CBD2',
    colors: ['#2970FF', '#006600', '#FF0090']
  }
}

function zipXYData (gData, isHeightAxis, isDayBinned, coefficient, windowS, initValue) {
  windowS = windowS || 1
  initValue = initValue || 0
  coefficient = coefficient || 1
  return map(gData.x, (n, i) => {
    var xAxisVal
    if (isHeightAxis && isDayBinned) {
      xAxisVal = n
    } else if (isHeightAxis) {
      xAxisVal = (i * windowS) + initValue
    } else {
      xAxisVal = new Date(n * 1000)
    }
    return [xAxisVal, gData.y[i] * coefficient]
  })
}

function poolSizeFunc (gData, isHeightAxis, isDayBinned) {
  var data = map(gData.x, (n, i) => {
    var xAxisVal
    if (isHeightAxis && isDayBinned) {
      xAxisVal = n
    } else if (isHeightAxis) {
      xAxisVal = i
    } else {
      xAxisVal = new Date(n * 1000)
    }
    return [xAxisVal, gData.y[i], null]
  })
  if (data.length) {
    data[0][2] = ticketPoolSizeTarget
    data[data.length - 1][2] = ticketPoolSizeTarget
  }
  return data
}

function zipXYZData (gData, isHeightAxis, isDayBinned, yCoefficient, zCoefficient, windowS) {
  windowS = windowS || 1
  yCoefficient = yCoefficient || 1
  zCoefficient = zCoefficient || 1
  return map(gData.x, (n, i) => {
    var xAxisVal
    if (isHeightAxis && isDayBinned) {
      xAxisVal = n
    } else if (isHeightAxis) {
      xAxisVal = i * windowS
    } else {
      xAxisVal = new Date(n * 1000)
    }
    return [xAxisVal, gData.y[i] * yCoefficient, gData.z[i] * zCoefficient]
  })
}

function percentStakedFunc (gData, isHeightAxis, isDayBinned) {
  var extremeStaked = 0
  var data = map(gData.x, (n, i) => {
    let poolValue = gData.z[i]
    let coinSupply = gData.y[i] * atomsToDCR
    let percentStaked = (poolValue / coinSupply) * 100
    if (percentStaked > extremeStaked) extremeStaked = percentStaked
    var xAxisVal
    if (isHeightAxis && isDayBinned) {
      xAxisVal = n
    } else if (isHeightAxis) {
      xAxisVal = i
    } else {
      xAxisVal = new Date(n * 1000)
    }
    rawPoolValue.push(poolValue)
    rawCoinSupply.push(coinSupply)
    return [ xAxisVal, percentStaked ]
  })
  return [data, extremeStaked]
}

function circulationFunc (gData, isHeightAxis, isDayBinned) {
  var y = 0
  var h = -1
  var addDough = (newHeight) => {
    while (h < newHeight) {
      h++
      y += blockReward(h) * atomsToDCR
    }
  }

  var inflation = []
  var data = map(gData.x, (n, i) => {
    var xAxisVal, height
    if (isHeightAxis && isDayBinned) {
      xAxisVal = n
      height = n
    } else if (isHeightAxis) {
      xAxisVal = i
      height = i
    } else {
      xAxisVal = new Date(n * 1000)
      height = !gData.z ? i : gData.z[i]
    }
    addDough(height)
    inflation.push(y)
    return [xAxisVal, gData.y[i] * atomsToDCR, null]
  })

  var dailyBlocks = aDay / avgBlockTime
  var lastPt = data[data.length - 1]
  var lastxValueSet = lastPt[0]
  // Set y to the start at last actual supply for the prediction line.
  y = lastPt[1]
  if (!isHeightAxis) lastxValueSet = lastxValueSet.getTime()
  var projection = 6 * aMonth
  for (var i = 1; i <= projection; i++) {
    addDough(h + dailyBlocks)
    if (isHeightAxis) {
      lastxValueSet += dailyBlocks
      data.push([lastxValueSet, null, y])
    } else {
      lastxValueSet += aDay
      data.push([new Date(lastxValueSet), null, y])
    }
  }
  return {
    data: data,
    inflation: inflation
  }
}

function mapDygraphOptions (data, labelsVal, isDrawPoint, yLabel, labelsMG, labelsMG2) {
  return merge({
    'file': data,
    labels: labelsVal,
    drawPoints: isDrawPoint,
    ylabel: yLabel,
    labelsKMB: labelsMG2 && labelsMG ? false : labelsMG,
    labelsKMG2: labelsMG2 && labelsMG ? false : labelsMG2
  }, nightModeOptions(darkEnabled()))
}

export default class extends Controller {
  static get targets () {
    return [
      'chartWrapper',
      'labels',
      'chartsView',
      'chartSelect',
      'zoomSelector',
      'zoomOption',
      'scaleType',
      'axisOption',
      'binSelector',
      'scaleSelector',
      'dualAxesSelector',
      'customAxisSelector',
      'customAxisOption',
      'optionLabel1',
      'optionLabel2',
      'limitLabel',
      'vSelector',
      'zoomLabel',
      'binSize',
      'option1',
      'option2'
    ]
  }

  async connect () {
    this.query = new TurboQuery()
    ticketPoolSizeTarget = parseInt(this.data.get('tps'))
    premine = parseInt(this.data.get('premine'))
    stakeValHeight = parseInt(this.data.get('svh'))
    stakeShare = parseInt(this.data.get('pos')) / 10.0
    baseSubsidy = parseInt(this.data.get('bs'))
    subsidyInterval = parseInt(this.data.get('sri'))
    subsidyExponent = parseFloat(this.data.get('mulSubsidy')) / parseFloat(this.data.get('divSubsidy'))
    windowSize = parseInt(this.data.get('windowSize'))
    avgBlockTime = parseInt(this.data.get('blockTime')) * 1000

    this.settings = TurboQuery.nullTemplate(['chart', 'zoom', 'scale', 'bin', 'axis', 'limit'])
    this.query.update(this.settings)
    this.settings.chart = this.settings.chart || 'ticket-price'
    this.zoomCallback = this._zoomCallback.bind(this)
    this.drawCallback = this._drawCallback.bind(this)
    this.limits = null
    this.lastZoom = null
    Dygraph = await getDefault(
      import(/* webpackChunkName: "dygraphs" */ '../vendor/dygraphs.min.js')
    )
    this.drawInitialGraph()
    this.processNightMode = (params) => {
      this.chartsView.updateOptions(
        nightModeOptions(params.nightMode)
      )
    }
    globalEventBus.on('NIGHT_MODE', this.processNightMode)
  }

  disconnect () {
    globalEventBus.off('NIGHT_MODE', this.processNightMode)
    if (this.chartsView !== undefined) {
      this.chartsView.destroy()
    }
    selectedChart = null
  }

  drawInitialGraph () {
    var options = {
      axes: { y: { axisLabelWidth: 70 }, y2: { axisLabelWidth: 70 } },
      labels: ['Date', 'Ticket Price', 'Tickets Bought'],
      digitsAfterDecimal: 8,
      showRangeSelector: true,
      rangeSelectorPlotFillColor: '#8997A5',
      rangeSelectorAlpha: 0.4,
      rangeSelectorHeight: 40,
      drawPoints: true,
      pointSize: 0.25,
      legend: 'always',
      labelsSeparateLines: true,
      labelsDiv: this.labelsTarget,
      legendFormatter: legendFormatter,
      highlightCircleSize: 4,
      ylabel: 'Ticket Price',
      y2label: 'Tickets Bought',
      labelsUTC: true
    }

    this.chartsView = new Dygraph(
      this.chartsViewTarget,
      [[1, 1, 5], [2, 5, 11]],
      options
    )
    this.chartSelectTarget.value = this.settings.chart

    if (this.settings.axis) this.setAxis(this.settings.axis) // set first
    if (this.settings.scale === 'log') this.setScale(this.settings.scale)
    let zoomLimit = false
    if (isAllControlsDisabled(this.settings.chart)) {
      zoomLimit = this.settings.limit
    } else {
      zoomLimit = this.settings.zoom
    }
    if (zoomLimit) this.setZoom(zoomLimit)
    if (this.settings.bin) this.setBin(this.settings.bin)

    var ogLegendGenerator = Dygraph.Plugins.Legend.generateLegendHTML
    Dygraph.Plugins.Legend.generateLegendHTML = (g, x, pts, w, row) => {
      g.updateOptions({ legendIndex: row }, true)
      return ogLegendGenerator(g, x, pts, w, row)
    }
    this.selectChart()
  }

  plotGraph (chartName, data) {
    var d = []
    var gOptions = {
      zoomCallback: null,
      drawCallback: null,
      logscale: this.settings.scale === 'log',
      valueRange: null,
      dateWindow: null,
      visibility: null,
      y2label: null,
      stepPlot: false,
      axes: {},
      series: null,
      inflation: null
    }
    var isHeightAxis = this.selectedAxis() === 'height'
    var xlabel = isHeightAxis ? 'Block Height' : 'Date'
    var isDayBinned = this.selectedBin() === 'day'
    var customLabel = customXLabel(this.chartSelectTarget.value)
    xlabel = customLabel !== '' ? customLabel : xlabel

    rawPoolValue = []
    rawCoinSupply = []

    switch (chartName) {
      case 'ticket-price': // price graph
        d = zipXYZData(data, isHeightAxis, false, atomsToDCR, 1, windowSize)
        gOptions.stepPlot = true
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Price', 'Tickets Bought'], true,
          'Price (DCR)', true, false))
        gOptions.y2label = 'Tickets Bought'
        gOptions.series = { 'Tickets Bought': { axis: 'y2' } }
        this.visibility = [this.option1Target.checked, this.option2Target.checked]
        gOptions.visibility = this.visibility
        gOptions.axes.y2 = {
          valueRange: [0, windowSize * 20 * 8],
          axisLabelFormatter: (y) => Math.round(y)
        }
        break

      case 'ticket-pool-size': // pool size graph
        d = poolSizeFunc(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Ticket Pool Size', 'Network Target'],
          false, 'Ticket Pool Size', true, false))
        gOptions.series = {
          'Network Target': {
            strokePattern: [5, 3],
            connectSeparatedPoints: true,
            strokeWidth: 2,
            color: '#888'
          }
        }
        break
      case 'stake-participation':
        d = percentStakedFunc(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d[0], [xlabel, 'Stake Participation'], true,
          'Stake Participation (%)', true, false))
        break

      case 'ticket-pool-value': // pool value graph
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Ticket Pool Value'], true,
          'Ticket Pool Value (DCR)', true, false))
        break

      case 'block-size': // block size graph
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Block Size'], false, 'Block Size', true, false))
        break

      case 'blockchain-size': // blockchain size graph
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Blockchain Size'], true,
          'Blockchain Size', false, true))
        break

      case 'tx-count': // tx per block graph
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Number of Transactions'], false,
          '# of Transactions', false, false))
        break

      case 'pow-difficulty': // difficulty graph
        d = zipXYData(data, isHeightAxis, false, 1, windowSize)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Difficulty'], true, 'Difficulty', true, false))
        break

      case 'coin-supply': // supply graph
        d = circulationFunc(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d.data, [xlabel, 'Coin Supply', 'Inflation Limit'],
          true, 'Coin Supply (DCR)', true, false))
        gOptions.series = {
          'Inflation Limit': {
            strokePattern: [5, 5],
            color: '#888',
            strokeWidth: 1.5
          }
        }
        gOptions.inflation = d.inflation
        break

      case 'fees': // block fee graph
        d = zipXYData(data, isHeightAxis, isDayBinned, atomsToDCR)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Total Fee'], false, 'Total Fee (DCR)', true, false))
        break

      case 'duration-btw-blocks': // Duration between blocks graph
        d = zipXYZData(data, true, true)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Actual Count', 'Expected Count'], false,
          'Blocks Count', false, false))
        sum = data.y.reduce((total, n) => total + n)
        this.visibility = [this.option1Target.checked, this.option2Target.checked]
        gOptions.visibility = this.visibility
        break

      case 'chainwork': // Total chainwork over time
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Cumulative Chainwork (exahash)'],
          false, 'Cumulative Chainwork (exahash)', true, false))
        break

      case 'hashrate': // Total chainwork over time
        d = zipXYData(data, isHeightAxis, isDayBinned)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Network Hashrate (terahash/s)'],
          false, 'Network Hashrate (terahash/s)', true, false))
        break

      case 'missed-votes':
        d = zipXYData(data, isHeightAxis, false, 1, windowSize, stakeValHeight)
        assign(gOptions, mapDygraphOptions(d, [xlabel, 'Missed Votes'], false,
          'Missed Votes per Window', true, false))
        break
    }

    this.chartsView.plotter_.clear()
    this.chartsView.updateOptions(gOptions, false)
    if (yValueRanges[chartName]) this.supportedYRange = this.chartsView.yAxisRanges()
    this.validateZoom()
  }

  async selectChart () {
    this.setVisibility()
    var selection = this.settings.chart = this.chartSelectTarget.value
    this.chartWrapperTarget.classList.add('loading')
    this.toggleAllControls(isAllControlsDisabled(selection))
    if (isAllControlsDisabled(selection)) {
      this.customAxisOptionTarget.innerHTML = customXLabel(selection)
    } else {
      this.toggleBinControls(isBinDisabled(selection))
      this.toggleScaleControls(isScaleDisabled(selection))
    }

    if (selectedChart !== selection || this.settings.bin !== this.selectedBin() ||
      (this.settings.axis !== this.selectedAxis() && this.selectedAxis()) ||
      isAllControlsDisabled(selection)) {
      let searchParams = new URLSearchParams()
      if (isAllControlsDisabled(selection)) {
        var selected = this.selectedZoom()
        if (selected) searchParams.append('limit', selected)
      } else if (!isBinDisabled(selection)) {
        this.settings.bin = this.selectedBin()
        if (!this.settings.bin) this.settings.bin = 'day' // Set the default.
        searchParams.append('bin', this.settings.bin)
        this.setActiveOptionBtn(this.settings.bin, this.binSizeTargets)

        this.settings.axis = this.selectedAxis()
        if (!this.settings.axis) this.settings.axis = 'time' // Set the default.
        if (this.settings.bin === 'day' && this.settings.axis === 'height') {
          searchParams.append('axis', this.settings.axis)
        }
        this.setActiveOptionBtn(this.settings.axis, this.axisOptionTargets)
      }

      let url = '/api/chart/' + selection
      if (searchParams.toString()) url += '?' + searchParams.toString()
      let chartResponse = await axios.get(url)
      console.log('got api data', chartResponse, this, selection)
      selectedChart = selection
      this.plotGraph(selection, chartResponse.data)
    } else {
      this.chartWrapperTarget.classList.remove('loading')
    }
  }

  async validateZoom () {
    await animationFrame()
    this.chartWrapperTarget.classList.add('loading')
    await animationFrame()
    let oldLimits = this.limits || this.chartsView.xAxisExtremes()
    this.limits = this.chartsView.xAxisExtremes()
    var selected = this.selectedZoom()
    if (selected) {
      this.lastZoom = Zoom.validate(selected, this.limits,
        this.isTimeAxis() ? avgBlockTime : 1, this.isTimeAxis() ? 1 : avgBlockTime)
    } else {
      this.lastZoom = Zoom.project(this.settings.zoom, oldLimits, this.limits)
    }
    if (this.lastZoom && !isAllControlsDisabled(this.chartSelectTarget.value)) {
      this.chartsView.updateOptions({
        dateWindow: [this.lastZoom.start, this.lastZoom.end]
      })
    }
    if (selected !== this.settings.zoom) {
      this._zoomCallback(this.lastZoom.start, this.lastZoom.end)
    }
    await animationFrame()
    this.chartWrapperTarget.classList.remove('loading')
    this.chartsView.updateOptions({
      zoomCallback: this.zoomCallback,
      drawCallback: this.drawCallback
    })
  }

  _zoomCallback (start, end) {
    let currentSettings = {}
    if (this.isSpecialXAxis()) {
      this.settings.limit = this.selectedZoom()
      currentSettings = this.settings
      this.query.nullEntry(currentSettings, ['zoom', 'axis', 'bin', 'scale'])
      this.query.replace(currentSettings)
      return
    }

    this.lastZoom = Zoom.object(start, end)
    this.settings.zoom = Zoom.encode(this.lastZoom)
    currentSettings = this.settings
    this.query.nullEntry(currentSettings, ['limit'])
    this.query.replace(currentSettings)
    let ex = this.chartsView.xAxisExtremes()
    let option = Zoom.mapKey(this.settings.zoom, ex, this.isTimeAxis() ? 1 : avgBlockTime)
    this.setActiveOptionBtn(option, this.zoomOptionTargets)
    var axesData = axesToRestoreYRange(this.settings.chart,
      this.supportedYRange, this.chartsView.yAxisRanges())
    if (axesData) this.chartsView.updateOptions({ axes: axesData })
  }

  isSpecialXAxis () {
    return customXLabel(this.chartSelectTarget.value) !== ''
  }

  isTimeAxis () {
    return this.selectedAxis() === 'time'
  }

  _drawCallback (graph, first) {
    if (first) return
    var start, end
    [start, end] = this.chartsView.xAxisRange()
    if (start === end) return
    if (this.lastZoom.start === start) return // only handle slide event.
    this._zoomCallback(start, end)
  }

  toggleAllControls (isAllDisabled) {
    this.toggleBinControls(isAllDisabled)
    this.toggleAxisControls(isAllDisabled)
    this.toggleScaleControls(isAllDisabled)
    this.toggleZoomLabelControls(isAllDisabled)
  }

  toggleVisibilityControls (isVEnabled) {
    var vControl = this.vSelectorTarget.classList
    isVEnabled ? vControl.remove('d-hide') : vControl.add('d-hide')
  }

  toggleScaleControls (isScaleDisabled) {
    var scaleControl = this.scaleSelectorTarget.classList
    isScaleDisabled ? scaleControl.add('d-hide') : scaleControl.remove('d-hide')
  }

  toggleZoomLabelControls (isZoomDisabled) {
    var zoomControl = this.zoomLabelTarget.classList
    var limitControl = this.limitLabelTarget.classList
    isZoomDisabled ? zoomControl.add('d-hide') : zoomControl.remove('d-hide')
    isZoomDisabled ? limitControl.remove('d-hide') : limitControl.add('d-hide')
  }

  toggleBinControls (isBinControls) {
    var binControl = this.binSelectorTarget.classList
    isBinControls ? binControl.add('d-hide') : binControl.remove('d-hide')
  }

  toggleAxisControls (isAxesControls) {
    var dualAxes = this.dualAxesSelectorTarget.classList
    var customAxis = this.customAxisSelectorTarget.classList
    isAxesControls ? dualAxes.add('d-hide') : dualAxes.remove('d-hide')
    isAxesControls ? customAxis.remove('d-hide') : customAxis.add('d-hide')
  }

  setZoom (e) {
    var target = e.srcElement || e.target
    var option
    if (!target) {
      let ex = this.chartsView.xAxisExtremes()
      option = Zoom.mapKey(e, ex, this.isTimeAxis() ? 1 : avgBlockTime)
    } else {
      option = target.dataset.option
    }
    this.setActiveOptionBtn(option, this.zoomOptionTargets)
    if (!target) return // Exit if running for the first time
    if (this.isSpecialXAxis()) return this.selectChart()
    this.validateZoom()
  }

  setBin (e) {
    var target = e.srcElement || e.target
    var option = target ? target.dataset.option : e
    if (!option) return
    this.setActiveOptionBtn(option, this.binSizeTargets)
    if (!target) return // Exit if running for the first time.
    selectedChart = null // Force fetch
    this.selectChart()
  }

  setScale (e) {
    var target = e.srcElement || e.target
    var option = target ? target.dataset.option : e
    if (!option) return
    this.setActiveOptionBtn(option, this.scaleTypeTargets)
    if (!target) return // Exit if running for the first time.
    if (this.chartsView) {
      this.chartsView.updateOptions({ logscale: option === 'log' })
    }
    this.settings.scale = option
    this.query.replace(this.settings)
  }

  setAxis (e) {
    var target = e.srcElement || e.target
    var option = target ? target.dataset.option : e
    if (!option) return
    this.setActiveOptionBtn(option, this.axisOptionTargets)
    if (!target) return // Exit if running for the first time.
    this.settings.axis = null
    this.selectChart()
  }

  setVisibility (e) {
    var labelStr = VisibilityLabels(this.chartSelectTarget.value)
    this.toggleVisibilityControls(labelStr)
    if (!labelStr) return

    this.optionLabel1Target.innerHTML = labelStr.option1
    this.optionLabel2Target.innerHTML = labelStr.option2

    if (!this.option1Target.checked && !this.option2Target.checked) {
      this.option1Target.checked = this.visibility[0]
      this.option2Target.checked = this.visibility[1]
    } else {
      this.visibility = [this.option1Target.checked, this.option2Target.checked]
      this.chartsView.updateOptions({ visibility: this.visibility })
    }
  }

  setActiveOptionBtn (opt, optTargets) {
    optTargets.forEach(li => {
      if (li.dataset.option === opt) {
        li.classList.add('active')
      } else {
        li.classList.remove('active')
      }
    })
  }

  selectedZoom () { return this.selectedOption(this.zoomOptionTargets) }
  selectedBin () { return this.selectedOption(this.binSizeTargets) }
  selectedScale () { return this.selectedOption(this.scaleTypeTargets) }
  selectedAxis () { return this.selectedOption(this.axisOptionTargets) }

  selectedOption (optTargets) {
    var key = false
    optTargets.forEach((el) => {
      if (el.classList.contains('active')) key = el.dataset.option
    })
    return key
  }
}
