'use client';

/**
 * 전자서명 컴포넌트
 * Canvas 기반 서명 입력
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
  backgroundColor?: string;
  disabled?: boolean;
  className?: string;
}

export function SignaturePad({
  onSave,
  onClear,
  width = 400,
  height = 200,
  penColor = '#000000',
  penWidth = 2,
  backgroundColor = '#ffffff',
  disabled = false,
  className = '',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  // 캔버스 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 고해상도 디스플레이 대응
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 배경색 설정
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 펜 설정
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setContext(ctx);
  }, [width, height, penColor, penWidth, backgroundColor]);

  // 좌표 계산
  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        // 터치 이벤트
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      } else {
        // 마우스 이벤트
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    },
    []
  );

  // 그리기 시작
  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !context) return;

      e.preventDefault();
      const coords = getCoordinates(e);
      if (!coords) return;

      setIsDrawing(true);
      context.beginPath();
      context.moveTo(coords.x, coords.y);
    },
    [disabled, context, getCoordinates]
  );

  // 그리기
  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled || !context) return;

      e.preventDefault();
      const coords = getCoordinates(e);
      if (!coords) return;

      context.lineTo(coords.x, coords.y);
      context.stroke();
      setIsEmpty(false);
    },
    [isDrawing, disabled, context, getCoordinates]
  );

  // 그리기 종료
  const stopDrawing = useCallback(() => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  }, [context]);

  // 지우기
  const handleClear = useCallback(() => {
    if (!context || !canvasRef.current) return;

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    setIsEmpty(true);

    onClear?.();
  }, [context, width, height, backgroundColor, onClear]);

  // 저장
  const handleSave = useCallback(() => {
    if (!canvasRef.current || isEmpty) return;

    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  }, [isEmpty, onSave]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div
        className="border rounded-lg overflow-hidden bg-white"
        style={{ width, height }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width,
            height,
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="flex-1"
        >
          지우기
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || isEmpty}
          className="flex-1"
        >
          서명 완료
        </Button>
      </div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground text-center">
          위 영역에 서명해주세요
        </p>
      )}
    </div>
  );
}

// 서명 미리보기 컴포넌트
interface SignaturePreviewProps {
  signature: string;
  width?: number;
  height?: number;
  className?: string;
}

export function SignaturePreview({
  signature,
  width = 200,
  height = 100,
  className = '',
}: SignaturePreviewProps) {
  if (!signature) {
    return (
      <div
        className={`border rounded-lg bg-gray-50 flex items-center justify-center text-muted-foreground ${className}`}
        style={{ width, height }}
      >
        서명 없음
      </div>
    );
  }

  return (
    <img
      src={signature}
      alt="서명"
      className={`border rounded-lg object-contain ${className}`}
      style={{ width, height }}
    />
  );
}

// 서명 입력 모달용 컴포넌트
interface SignatureModalContentProps {
  onSave: (signature: string) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function SignatureModalContent({
  onSave,
  onCancel,
  title = '서명하기',
  description = '아래 영역에 서명해주세요.',
}: SignatureModalContentProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <SignaturePad onSave={onSave} />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

export default SignaturePad;
