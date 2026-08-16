/**
 * BackgroundLayer — aurora background layer, pure CSS animation.
 * Server-side rendered, zero JS overhead.
 */
export default function BackgroundLayer() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__grid"></div>
      <div className="aurora__blob aurora__blob--violet"></div>
      <div className="aurora__blob aurora__blob--cyan"></div>
      <div className="aurora__blob aurora__blob--pink"></div>
      <div className="aurora__noise"></div>
    </div>
  )
}
