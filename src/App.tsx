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
  const [mathWorker, setMathWorker] = useState<any>(null);
  const [history, setHistory] = useState<any[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setCanvasWidth(canvasContainerRef.current.offsetWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  
  useEffect(() => {
    const initWorkers = async () => {
     
      const newWorker = await createWorker();
      await newWorker.load();
      await newWorker.loadLanguage('eng');
      await newWorker.initialize('eng', {
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/()=.,?!:;%$#@&<>[]{}',
        tessedit_pageseg_mode: '6', 
        preserve_interword_spaces: '1'
      });
      setWorker(newWorker);

      
      const mathOcrWorker = await createWorker();
      await mathOcrWorker.load();
      await mathOcrWorker.loadLanguage('eng');
      await mathOcrWorker.initialize('eng', {
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/()=.,?!:;%$#@&<>[]{}∫∑∏√∂∆∇∞≈≠≤≥±÷×°∠πθαβγ',
        tessedit_pageseg_mode: '13', 
        textord_equation_detect: '1', 
        textord_tabfind_show_vlines: '0',
        preserve_interword_spaces: '1'
      });
      setMathWorker(mathOcrWorker);
    };
    
    initWorkers();
    
    return () => {
      if (worker) worker.terminate();
      if (mathWorker) mathWorker.terminate();
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
        
       
        canvas.width = img.width;
        canvas.height = img.height;
        
        
        ctx.drawImage(img, 0, 0);
        
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
         
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          
          const threshold = 180; 
          const newValue = gray > threshold ? 255 : 0;
          
          
          data[i] = newValue;
          data[i + 1] = newValue;
          data[i + 2] = newValue;
        }
        
        
        ctx.putImageData(imageData, 0, 0);
        
        
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      
      img.src = dataUrl;
    });
  };

 
  const enhanceImageForMath = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        
        const factor = 1.5;
        
        for (let i = 0; i < data.length; i += 4) {
          
          for (let j = 0; j < 3; j++) {
            const val = data[i + j];
            
            const newVal = 128 + factor * (val - 128);
            data[i + j] = Math.min(255, Math.max(0, newVal));
          }
          
         
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const binary = gray > 150 ? 255 : 0;
          
          data[i] = binary;
          data[i + 1] = binary;
          data[i + 2] = binary;
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      
      img.src = dataUrl;
    });
  };

  
  const extractTextFromRegions = async (dataUrl: string): Promise<string> => {
    if (!worker || !mathWorker) return '';
    
    try {
      const img = new Image();
      await new Promise(resolve => {
        img.onload = resolve;
        img.src = dataUrl;
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
     
      const processedStandard = await preprocessImage(dataUrl);
      const processedMath = await enhanceImageForMath(dataUrl);
      
      
      const results = await Promise.all([
        worker.recognize(processedStandard),
        mathWorker.recognize(processedMath)
      ]);
      
      let combinedText = '';
      
      
      const normalText = results[0].data.text.trim();
      
      
      const mathText = results[1].data.text.trim();
      
      
      if (mathText.includes('=') || 
          mathText.includes('+') || 
          mathText.includes('-') || 
          mathText.includes('×') || 
          mathText.includes('÷') ||
          mathText.includes('∫') ||
          mathText.includes('∑')) {
        combinedText = mathText;
      } else if (normalText.length > mathText.length) {
        combinedText = normalText;
      } else {
        combinedText = mathText;
      }
      
      return combinedText;
    } catch (error) {
      console.error('Error splitting image:', error);
      return '';
    }
  };

  const extractTextFromCanvas = async () => {
    if (!stageRef.current || !worker || !mathWorker) return '';
    
    setIsProcessing(true);
    
    try {
      const canvasElement = document.getElementById('canvas-container');
      if (!canvasElement) return '';
      
      
      const dataUrl = await toJpeg(canvasElement, { quality: 1.0, backgroundColor: 'white' });
      
      
      const extractedText = await extractTextFromRegions(dataUrl);
      
      let finalText = extractedText.trim();
      
      
      if (finalText.length < 5 || finalText.split(' ').length < 2) {
        finalText = "[Image contains a diagram or equation that couldn't be fully recognized as text]";
      }
      
      setExtractedText(finalText);
      return finalText;
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
      
      
      const canvasElement = document.getElementById('canvas-container');
      let imageBase64 = '';
      
      if (canvasElement) {
        const dataUrl = await toJpeg(canvasElement, { quality: 1.0, backgroundColor: 'white' });
        imageBase64 = dataUrl.split(',')[1]; 
      }
      
      if (!text && !imageBase64) {
        setAnswer('No content detected on the whiteboard. Please write your question clearly.');
        return;
      }
      
      
      let promptText = '';
      
      if (text.includes("[Image contains")) {
        promptText = "I've written something on a whiteboard that appears to be a diagram, equation, or drawing. Please analyze what's in the image and provide a detailed explanation or solution.";
      } else {
        promptText = `Answer this question or solve this problem: ${text}. Provide a clear, step-by-step explanation.`;
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=ABCDEFYOUROWNDAMNAPIBRO`,
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
                    text: promptText,
                  },
                 
                  ...(imageBase64 ? [{
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: imageBase64
                    }
                  }] : [])
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
        setAnswer('Sorry, I couldn\'t generate an answer. Please try rephrasing your question or drawing it more clearly.');
      }
    } catch (error) {
      console.error('Error generating answer:', error);
      setAnswer('An error occurred while generating the answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Touch events for mobile support
  const handleTouchStart = (e: any) => {
    e.evt.preventDefault();
    const touches = e.evt.touches[0];
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setIsDrawing(true);
    const newLine = {
      points: [pos.x, pos.y],
      color: brushColor,
      strokeWidth: brushRadius,
      tool: isEraser ? 'eraser' : 'pen',
    };
    setCurrentLine(newLine);
  };

  const handleTouchMove = (e: any) => {
    e.evt.preventDefault();
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    setCurrentLine((prevLine: any) => {
      return {
        ...prevLine,
        points: [...prevLine.points, pos.x, pos.y],
      };
    });
  };

  const handleTouchEnd = (e: any) => {
    e.evt.preventDefault();
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
          <div className="relative bg-white" id="canvas-container" ref={canvasContainerRef}>
            <Stage
              width={canvasWidth}
              height={500}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseup={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              ref={stageRef}
              style={{ width: '100%', height: '500px' }}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={canvasWidth}
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
          
          {/* Extraction Status */}
          {isProcessing && (
            <div className="p-2 bg-purple-100 border-t border-purple-200 text-center">
              <p className="text-sm text-purple-800">
                <Loader2 size={16} className="inline animate-spin mr-1" />
                Analyzing your whiteboard content...
              </p>
            </div>
          )}
          
          {/* Extracted Text (Optional) */}
          {extractedText && !isProcessing && (
            <div className="p-2 bg-gray-100 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Detected content: <span className="font-mono">{extractedText}</span>
                {extractedText.includes("[Image contains") && (
                  <span className="ml-2 text-gray-500 italic">(Using image recognition since text detection was limited)</span>
                )}
              </p>
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
          <p>Write your question, equation, or draw a diagram on the whiteboard and click "Generate Answer" to get a solution.</p>
          <p className="mt-1">Supports mathematical equations, general knowledge questions, diagrams, and more!</p>
        </div>
      </div>
    </div>
  );
}

export default App;
