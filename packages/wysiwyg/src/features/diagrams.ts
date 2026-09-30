import type { DiagramRenderer } from './types'

type DiagramLib = unknown

async function loadLib(name: string): Promise<DiagramLib> {
  // muya's exports map is "./*" -> "./src/*"; wildcard subpaths do not get
  // index resolution, so the file path must be spelled out. No ambient
  // declaration: every consuming tsconfig (this package's and the desktop's)
  // fails to resolve the path, which keeps the expect-error valid everywhere.
  // @ts-expect-error -- runtime-resolved muya deep import
  const mod = await import('@muyajs/core/utils/diagram/index')
  return (mod as { default: (n: string) => Promise<DiagramLib> }).default(name)
}

interface PlantumlDiagram {
  insertImgElement: (container: HTMLElement) => void
}
interface ParsedDiagram {
  drawSVG: (container: HTMLElement, options?: Record<string, unknown>) => void
}
interface FlowchartLib {
  parse: (code: string) => ParsedDiagram
}
interface SequenceLib {
  parse: (code: string) => ParsedDiagram
}
interface PlantumlLib {
  parse: (code: string, server?: string) => PlantumlDiagram
}
interface VegaEmbedLib {
  (el: HTMLElement, spec: unknown, options?: Record<string, unknown>): Promise<void>
}
interface MermaidLib {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidSeq = 0

/**
 * Default diagram renderer reusing muya's lazy loaders. The invocation
 * shapes mirror muya's export pipeline (markdownToHtml.ts), including the
 * vega `ast` option required by the sandboxed renderer's CSP.
 */
export function createDefaultDiagramRenderer(plantumlServer?: string): DiagramRenderer {
  return async(code, lang, container) => {
    if (lang === 'mermaid') {
      const mermaid = (await loadLib('mermaid')) as MermaidLib
      mermaid.initialize({ startOnLoad: false })
      const { svg } = await mermaid.render(`wysiwyg-mermaid-${++mermaidSeq}`, code)
      container.innerHTML = svg
      return
    }
    if (lang === 'vega-lite') {
      const embed = (await loadLib('vega-lite')) as VegaEmbedLib
      await embed(container, JSON.parse(code), {
        actions: false,
        tooltip: false,
        renderer: 'svg',
        theme: 'latimes',
        ast: true
      })
      return
    }
    if (lang === 'plantuml') {
      const lib = (await loadLib('plantuml')) as PlantumlLib
      container.innerHTML = ''
      const diagram = lib.parse(code, plantumlServer)
      diagram.insertImgElement(container)
      return
    }
    if (lang === 'flowchart' || lang === 'sequence') {
      const lib = (await loadLib(lang)) as FlowchartLib | SequenceLib
      container.innerHTML = ''
      const diagram = lib.parse(code)
      diagram.drawSVG(container, lang === 'sequence' ? { theme: 'hand' } : {})
      return
    }
    throw new Error(`Unknown diagram language: ${lang}`)
  }
}
