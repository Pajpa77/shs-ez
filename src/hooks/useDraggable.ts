import { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
  orientation?: 'portrait' | 'landscape';
}

interface UseDraggableOptions {
  storageKey?: string;
  defaultPosition?: Position;
  disabled?: boolean;
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { storageKey, defaultPosition, disabled = false } = options;

  const [position, setPosition] = useState<Position | null>(() => {
    if (storageKey && typeof localStorage !== 'undefined' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`draggable_pos_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const isMobile = window.innerWidth < 768 || window.innerHeight <= 500;
          const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
          // On mobile smartphones, if saved coordinates belong to a different orientation, discard them so responsive CSS takes over
          if (isMobile && parsed.orientation && parsed.orientation !== currentOrientation) {
            return defaultPosition || null;
          }
          return parsed;
        }
      } catch {}
    }
    return defaultPosition || null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const startPosRef = useRef<{ pageX: number; pageY: number; initialX: number; initialY: number }>({
    pageX: 0,
    pageY: 0,
    initialX: 0,
    initialY: 0,
  });

  const clampPosition = useCallback((pos: Position, node: HTMLElement): Position => {
    const rect = node.getBoundingClientRect();
    const margin = 8;
    const isLandscapeMobile = window.innerHeight <= 500;
    const minY = isLandscapeMobile ? 56 : 60;
    const bottomNavHeight = isLandscapeMobile ? 56 : 75;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(minY, window.innerHeight - rect.height - bottomNavHeight);

    const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    return {
      x: Math.min(Math.max(margin, pos.x), maxX),
      y: Math.min(Math.max(minY, pos.y), maxY),
      orientation: currentOrientation,
    };
  }, []);

  // Auto-clamp position whenever viewport resizes or device orientation changes (e.g. smartphone rotation)
  useEffect(() => {
    let lastOrientation = typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

    const checkAndClamp = () => {
      if (!dragRef.current) return;

      const isMobile = window.innerWidth < 768 || window.innerHeight <= 500;
      const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

      // On mobile smartphones rotating between portrait and landscape (in either direction):
      // Reset position to null so default responsive CSS dock classes take over without collision
      if (isMobile && currentOrientation !== lastOrientation) {
        lastOrientation = currentOrientation;
        setPosition(null);
        if (storageKey) {
          try {
            localStorage.removeItem(`draggable_pos_${storageKey}`);
          } catch {}
        }
        return;
      }
      lastOrientation = currentOrientation;

      setPosition((prev) => {
        if (!prev || !dragRef.current) return prev;
        const clamped = clampPosition(prev, dragRef.current);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          if (storageKey) {
            try {
              localStorage.setItem(`draggable_pos_${storageKey}`, JSON.stringify(clamped));
            } catch {}
          }
          return clamped;
        }
        return prev;
      });
    };

    const handleOrientationOrResize = () => {
      checkAndClamp();
      setTimeout(checkAndClamp, 80);
      setTimeout(checkAndClamp, 200);
      setTimeout(checkAndClamp, 350);
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    const timer = setTimeout(checkAndClamp, 200);

    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
      clearTimeout(timer);
    };
  }, [clampPosition, storageKey]);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !dragRef.current) return;

      const rect = dragRef.current.getBoundingClientRect();
      const currentX = position ? position.x : rect.left;
      const currentY = position ? position.y : rect.top;

      startPosRef.current = {
        pageX: clientX,
        pageY: clientY,
        initialX: currentX,
        initialY: currentY,
      };

      setIsDragging(true);
    },
    [disabled, position]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea, a')) return;
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea, a')) return;
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      const deltaX = clientX - startPosRef.current.pageX;
      const deltaY = clientY - startPosRef.current.pageY;

      const newPos = {
        x: startPosRef.current.initialX + deltaX,
        y: startPosRef.current.initialY + deltaY,
      };

      const clamped = clampPosition(newPos, dragRef.current);
      setPosition(clamped);
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      if (position && storageKey) {
        try {
          const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
          localStorage.setItem(
            `draggable_pos_${storageKey}`,
            JSON.stringify({ ...position, orientation: currentOrientation })
          );
        } catch {}
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, clampPosition, position, storageKey]);

  const resetPosition = useCallback(() => {
    setPosition(defaultPosition || null);
    if (storageKey) {
      try {
        localStorage.removeItem(`draggable_pos_${storageKey}`);
      } catch {}
    }
  }, [defaultPosition, storageKey]);

  return {
    dragRef,
    position,
    isDragging,
    dragProps: {
      onMouseDown,
      onTouchStart,
    },
    resetPosition,
  };
}
