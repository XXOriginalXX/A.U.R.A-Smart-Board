declare module 'react-canvas-draw' {
  import * as React from 'react';

  export interface CanvasDrawProps {
    onChange?: (canvas: CanvasDraw) => void;
    loadTimeOffset?: number;
    lazyRadius?: number;
    brushRadius?: number;
    brushColor?: string;
    catenaryColor?: string;
    gridColor?: string;
    backgroundColor?: string;
    hideGrid?: boolean;
    canvasWidth?: number | string;
    canvasHeight?: number | string;
    disabled?: boolean;
    imgSrc?: string;
    saveData?: string;
    immediateLoading?: boolean;
    hideInterface?: boolean;
    gridSizeX?: number;
    gridSizeY?: number;
    gridLineWidth?: number;
    hideGridX?: boolean;
    hideGridY?: boolean;
    enablePanAndZoom?: boolean;
    mouseZoomFactor?: number;
    zoomExtents?: {
      min: number;
      max: number;
    };
    clampLinesToDocument?: boolean;
    style?: React.CSSProperties;
    className?: string;
  }

  export default class CanvasDraw extends React.Component<CanvasDrawProps> {
    clear: () => void;
    undo: () => void;
    getSaveData: () => string;
    getDataURL: () => string;
    loadSaveData: (saveData: string, immediate?: boolean) => void;
  }
}