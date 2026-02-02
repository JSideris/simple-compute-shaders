import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './App.css';
import { examples } from './examples';

function App() {
  const { exampleId } = useParams<{ exampleId: string }>();
  const navigate = useNavigate();
  
  const selectedExample = examples.find(ex => ex.id === exampleId) || examples[0];
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const sessionId = Math.random();
    sessionRef.current = sessionId;

    // Reset container and canvas
    containerRef.current.innerHTML = '';
    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Use ResizeObserver for more reliable canvas sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvas.parentElement) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Start new example
    const runExample = async () => {
      try {
        const cleanup = await selectedExample.start(canvas, container);
        
        // If session ID changed while we were awaiting, clean up immediately
        if (sessionRef.current !== sessionId) {
          cleanup();
          return;
        }
        
        cleanupRef.current = () => {
          cleanup();
        };
      } catch (error) {
        console.error('Failed to start example:', error);
      }
    };

    runExample();

    return () => {
      sessionRef.current = null;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [selectedExample]);

  return (
    <div className="app">
      <div className="sidebar">
        <h2>Examples</h2>
        <ul className="example-list">
          {examples.map((example) => (
            <li
              key={example.id}
              className={`example-item ${selectedExample.id === example.id ? 'active' : ''}`}
              onClick={() => navigate(`/${example.id}`)}
            >
              <h3>{example.name}</h3>
              <p>{example.description}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="main-content">
        <div className="canvas-container">
          <canvas ref={canvasRef} />
          <div ref={containerRef} className="controls-overlay" />
        </div>
      </div>
    </div>
  );
}

export default App;
