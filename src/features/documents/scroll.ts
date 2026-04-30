/**
 * Pure helper: returns true once the scroll position has reached the bottom
 * of a scrollable container, with a small tolerance to account for fractional
 * scaling on retina displays.
 */
export function isScrolledToBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  toleranceInPx = 4,
): boolean {
  if (scrollHeight <= clientHeight) {
    // Document fits without scrolling — there is no bottom to reach.
    return true;
  }
  return scrollTop + clientHeight + toleranceInPx >= scrollHeight;
}
