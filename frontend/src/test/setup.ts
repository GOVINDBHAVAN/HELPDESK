import '@testing-library/jest-dom'

// jsdom doesn't implement these, but Radix UI's Select (and other popover-based
// primitives) call them during pointer interactions and open/close animations.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
