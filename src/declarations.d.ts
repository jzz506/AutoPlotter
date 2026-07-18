declare module 'plotly.js-dist-min' {
  import * as Plotly from 'plotly.js'
  const PlotlyDefault: typeof Plotly
  export default PlotlyDefault
}

declare module '*?raw' {
  const content: string
  export default content
}
