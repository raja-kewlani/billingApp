import { useCallback, useRef } from "react";

interface LongPressOptions {
  delay?: number;
}

export function useLongPress(
  onLongPress: () => void,
  { delay = 500 }: LongPressOptions = {}
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLongPressTriggered = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      isLongPressTriggered.current = false;
      timeout.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = undefined;
      }
    },
    []
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
    onTouchMove: clear,
    onClick: (e: React.MouseEvent, onClickCallback: (e: React.MouseEvent) => void) => {
       if (isLongPressTriggered.current) {
           e.preventDefault();
           e.stopPropagation();
           isLongPressTriggered.current = false;
       } else {
           onClickCallback(e);
       }
    }
  };
}
