/**
 * BackgroundLayer — 极光背景层，纯 CSS 动画。
 * 服务端渲染，零 JS 增量。
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
