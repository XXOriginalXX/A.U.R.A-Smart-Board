import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import { toJpeg } from 'html-to-image';
import { createWorker } from 'tesseract.js';
import { Eraser, Pencil, Trash2, Wand2, Download, Undo, Loader2 } from 'lucide-react';

function App() {
  const stageRef = useRef<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [currentLine, setCurrentLine] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushRadius, setBrushRadius] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [worker, setWorker] = useState<any>(null);
  const [history, setHistory] = useState<any[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [extractedText, setExtractedText] = useState('');

  useEffect(() => {
    const initWorker = async () => {
      const newWorker = await createWorker();
      await newWorker.load();
      await newWorker.loadLanguage('eng');
      await newWorker.initialize('eng', {
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/()=.,?!:;%$#@&<>[]{}',
        tessedit_pageseg_mode: '6', // Assume a single uniform block of text
        tessedit_ocr_engine_mode: '2', // Use LSTM only
        preserve_interword_spaces: '1'
      });
      setWorker(newWorker);
    };
    
    initWorker();
    
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, []);

  const handleBrushColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushColor(e.target.value);
    setIsEraser(false);
  };

  const handleBrushRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushRadius(parseInt(e.target.value));
  };

  const toggleEraser = () => {
    setIsEraser(!isEraser);
    if (!isEraser) {
      setBrushColor('#FFFFFF');
    } else {
      setBrushColor('#000000');
    }
  };

  const handleMouseDown = (e: any) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newLine = {
      points: [pos.x, pos.y],
      color: brushColor,
      strokeWidth: brushRadius,
      tool: isEraser ? 'eraser' : 'pen',
    };
    setCurrentLine(newLine);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    setCurrentLine((prevLine: any) => {
      return {
        ...prevLine,
        points: [...prevLine.points, point.x, point.y],
      };
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setLines((prevLines) => {
      const newLines = [...prevLines, currentLine];
      // Save to history
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(newLines);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
      return newLines;
    });
  };

  const clearCanvas = () => {
    setLines([]);
    setAnswer('');
    setExtractedText('');
    // Save to history
    const newHistory = [...history, []];
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undoCanvas = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setLines(history[historyStep - 1]);
    } else {
      setLines([]);
    }
  };

  const saveCanvas = () => {
    if (stageRef.current) {
      const dataUrl = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = 'aura-whiteboard.png';
      link.href = dataUrl;
      link.click();
    }
  };

  const preprocessImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Increase contrast and convert to black and white
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Convert to grayscale
          const gray = 0.3 * r + 0.59 * g + 0.11 * b;
          
          // Apply threshold for black and white
          const threshold = 200;
          const newValue = gray > threshold ? 255 : 0;
          
          // Set RGB values to new value
          data[i] = newValue;
          data[i + 1] = newValue;
          data[i + 2] = newValue;
        }
        
        // Put processed image data back on canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Return processed image as data URL
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      
      img.src = dataUrl;
    });
  };

  const extractTextFromCanvas = async () => {
    if (!stageRef.current || !worker) return '';
    
    setIsProcessing(true);
    
    try {
      const canvasElement = document.getElementById('canvas-container');
      if (!canvasElement) return '';
      
      // Get image from canvas
      const dataUrl = await toJpeg(canvasElement, { quality: 1.0, backgroundColor: 'white' });
      
      // Preprocess the image to improve OCR accuracy
      const processedDataUrl = await preprocessImage(dataUrl);
      
      // Recognize text with multiple attempts using different settings
      const { data: { text } } = await worker.recognize(processedDataUrl);
      
      const cleanedText = text.trim();
      setExtractedText(cleanedText);
      return cleanedText;
    } catch (error) {
      console.error('Error extracting text:', error);
      return '';
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAnswer = async () => {
    setIsLoading(true);
    setAnswer('');
    
    try {
      const text = await extractTextFromCanvas();
      
      if (!text) {
        setAnswer('No text detected on the whiteboard. Please write your question clearly.');
        return;
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyC1ZxzbIibeZlKCUTKbYXgqPBhWYyIn1Pk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Answer this question or solve this problem: ${text}. Provide a clear, step-by-step explanation.`,
                  },
                ],
              },
            ],
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        setAnswer(data.candidates[0].content.parts[0].text);
      } else if (data.error) {
        setAnswer(`Error: ${data.error.message || 'Failed to generate answer'}`);
      } else {
        setAnswer('Sorry, I couldn\'t generate an answer. Please try rephrasing your question.');
      }
    } catch (error) {
      console.error('Error generating answer:', error);
      setAnswer('An error occurred while generating the answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const colorOptions = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080'];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">AURA Smart White Board</h1>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Toolbar */}
          <div className="bg-gray-800 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                className={`p-2 rounded ${!isEraser ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                onClick={() => setIsEraser(false)}
                title="Pen"
              >
                <Pencil size={20} />
              </button>
              <button
                className={`p-2 rounded ${isEraser ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                onClick={toggleEraser}
                title="Eraser"
              >
                <Eraser size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Color:</label>
              <div className="flex gap-1">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border ${brushColor === color && !isEraser ? 'border-white ring-2 ring-blue-500' : 'border-gray-400'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setBrushColor(color);
                      setIsEraser(false);
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={brushColor}
                  onChange={handleBrushColorChange}
                  className="w-6 h-6 rounded cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Size:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushRadius}
                onChange={handleBrushRadiusChange}
                className="w-24"
              />
              <span className="text-white text-sm">{brushRadius}px</span>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <button
                className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                onClick={undoCanvas}
                title="Undo"
              >
                <Undo size={20} />
              </button>
              <button
                className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                onClick={clearCanvas}
                title="Clear"
              >
                <Trash2 size={20} />
              </button>
              <button
                className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                onClick={saveCanvas}
                title="Save"
              >
                <Download size={20} />
              </button>
              <button
                className="p-2 rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                onClick={generateAnswer}
                disabled={isLoading || isProcessing}
                title="Generate Answer"
              >
                {isLoading || isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    <span>Generate Answer</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Canvas */}
          <div className="relative bg-white" id="canvas-container">
            <Stage
              width={window.innerWidth}
              height={500}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseup={handleMouseUp}
              ref={stageRef}
              style={{ width: '100%', height: '500px' }}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={window.innerWidth}
                  height={500}
                  fill="white"
                />
                {lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                  />
                ))}
                {currentLine && (
                  <Line
                    points={currentLine.points}
                    stroke={currentLine.color}
                    strokeWidth={currentLine.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      currentLine.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                  />
                )}
              </Layer>
            </Stage>
          </div>
          
          {/* Extracted Text (Optional) */}
          {extractedText && (
            <div className="p-2 bg-gray-100 border-t border-gray-200">
              <p className="text-sm text-gray-600">Detected text: <span className="font-mono">{extractedText}</span></p>
            </div>
          )}
          
          {/* Answer Section */}
          {answer && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <h2 className="text-xl font-semibold mb-2">Answer:</h2>
              <div className="bg-white p-4 rounded border border-gray-300 whitespace-pre-line">
                {answer}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>Write your question or equation on the whiteboard and click "Generate Answer" to get a solution.</p>
          <p className="mt-1">Supports mathematical equations, general knowledge questions, and more!</p>
        </div>
      </div>
    </div>
  );
}

export default App;