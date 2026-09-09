import { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  storageKey?: string;
  defaultPosition?: Position;
  disabled?: boolean;
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { storageKey, defaultPosition, disabled = false } = options;

  const [position, setPosition] = useState<Position | null>(() => {
    if (storageKey && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`draggable_pos_${storageKey}`);
        if (saved) return JSON.parse(saved);
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
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);

    return {
      x: Math.min(Math.max(0, pos.x), maxX),
      y: Math.min(Math.max(0, pos.y), maxY),
    };
  }, []);

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
          localStorage.setItem(`draggable_pos_${storageKey}`, JSON.stringify(position));
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
