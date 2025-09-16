import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings, BookOpen, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, Legend } from 'recharts';

// TypeScript interfaces
interface DataPoint {
  time: number;
  N?: number;
  P?: number;
  N1?: number;
  N2?: number;
}

interface BuilderElement {
  id: number;
  type: string;
  x: number;
  y: number;
  text?: string;
}

const PopulationEcologyPlatform = () => {
  const [activeTab, setActiveTab] = useState('builder');
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [data, setData] = useState<DataPoint[]>([]);
  const [builderElements, setBuilderElements] = useState<BuilderElement[]>([]);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    elementId: number | null;
    startX: number;
    startY: number;
    startElementX: number;
    startElementY: number;
  }>({ isDragging: false, elementId: null, startX: 0, startY: 0, startElementX: 0, startElementY: 0 });

  const [editingText, setEditingText] = useState<{
    id: number | null;
    value: string;
  }>({ id: null, value: '' });
  const canvasRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Model parameters
  const [params, setParams] = useState({
    // Exponential growth - discrete
    birthRate: 0.3,
    deathRate: 0.1,
    N0: 50,
    // Logistic growth - discrete
    K: 1000,
    // Predator-prey - DIFFERENTIAL EQUATIONS (Lotka-Volterra) - FIXED SCALING
    a: 1.0,    // Prey growth rate
    b: 0.01,   // Predation rate (reduced for better visualization)  
    c: 0.005,  // Predator efficiency (reduced)
    d: 0.8,    // Predator death rate
    P0: 50,    // More balanced initial populations
    // Competition - DIFFERENTIAL EQUATIONS (Lotka-Volterra)
    r1: 0.8,
    r2: 0.7,
    K1: 1000,
    K2: 1000,
    alpha12: 0.6,
    alpha21: 0.5,
    N1_0: 50,
    N2_0: 50,
    // Integration - SEPARATE VISUALIZATION AND INTEGRATION TIME STEPS
    dt: 0.02,      // Small integration time step for accuracy
    timeStep: 0.2  // Larger visualization time step
  });

  const [selectedModel, setSelectedModel] = useState('exponential');
  const [showEquation, setShowEquation] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [useTestData, setUseTestData] = useState(false);

  // Discrete simulation functions - for exponential and logistic
  const exponentialGrowthDiscrete = (N: number): number => {
    if (N <= 0) return 0;
    const netGrowthRate = params.birthRate - params.deathRate;
    return N * (1 + netGrowthRate);
  };

  const logisticGrowthDiscrete = (N: number): number => {
    if (N <= 0) return 0;
    const netGrowthRate = params.birthRate - params.deathRate;
    return N * (1 + netGrowthRate * (1 - N / params.K));
  };

  // Differential equation models using Euler integration with multiple steps
  const predatorPreyODE = (N: number, P: number, timeIncrement: number): { N: number; P: number } => {
    if (N <= 0 || P <= 0) {
      return { N: Math.max(0, N), P: Math.max(0, P) };
    }
    
    let currentN = N;
    let currentP = P;
    
    // Take multiple small integration steps for accuracy
    const steps = Math.ceil(timeIncrement / params.dt);
    const actualDt = timeIncrement / steps;
    
    for (let i = 0; i < steps; i++) {
      // Classic Lotka-Volterra equations:
      // dN/dt = aN - bNP  (prey growth - predation)
      // dP/dt = cNP - dP  (predator growth from predation - death)
      const dN_dt = params.a * currentN - params.b * currentN * currentP;
      const dP_dt = params.c * currentN * currentP - params.d * currentP;
      
      // Euler integration
      currentN = Math.max(0, currentN + dN_dt * actualDt);
      currentP = Math.max(0, currentP + dP_dt * actualDt);
    }
    
    // Debug output
    console.log(`Lotka-Volterra: N=${N.toFixed(1)} → ${currentN.toFixed(1)}, P=${P.toFixed(1)} → ${currentP.toFixed(1)}, steps=${steps}`);
    
    return { N: currentN, P: currentP };
  };

  const competitionODE = (N1: number, N2: number, timeIncrement: number): { N1: number; N2: number } => {
    if (N1 <= 0 || N2 <= 0) {
      return { N1: Math.max(0, N1), N2: Math.max(0, N2) };
    }
    
    let currentN1 = N1;
    let currentN2 = N2;
    
    // Take multiple small integration steps for accuracy
    const steps = Math.ceil(timeIncrement / params.dt);
    const actualDt = timeIncrement / steps;
    
    for (let i = 0; i < steps; i++) {
      // Lotka-Volterra competition equations:
      // dN1/dt = r1*N1*(1 - (N1 + α12*N2)/K1)
      // dN2/dt = r2*N2*(1 - (N2 + α21*N1)/K2)
      const dN1_dt = params.r1 * currentN1 * (1 - (currentN1 + params.alpha12 * currentN2) / params.K1);
      const dN2_dt = params.r2 * currentN2 * (1 - (currentN2 + params.alpha21 * currentN1) / params.K2);
      
      // Euler integration
      currentN1 = Math.max(0, currentN1 + dN1_dt * actualDt);
      currentN2 = Math.max(0, currentN2 + dN2_dt * actualDt);
    }
    
    // Debug output
    console.log(`Competition ODEs: N1=${N1.toFixed(1)} → ${currentN1.toFixed(1)}, N2=${N2.toFixed(1)} → ${currentN2.toFixed(1)}, steps=${steps}`);
    
    return { N1: currentN1, N2: currentN2 };
  };

  // Test data for debugging
  const testData: DataPoint[] = [
    { time: 0, N: 50, P: 20, N1: 50, N2: 50 },
    { time: 1, N: 55, P: 18, N1: 55, N2: 48 },
    { time: 2, N: 60, P: 16, N1: 60, N2: 46 },
    { time: 3, N: 65, P: 15, N1: 65, N2: 44 },
    { time: 4, N: 70, P: 14, N1: 70, N2: 42 },
    { time: 5, N: 75, P: 13, N1: 75, N2: 40 }
  ];

  // Use test data or simulation data
  const chartData = useTestData ? testData : data;

  // Animation loop - FIXED TIME SCALING
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    if (isPlaying) {
      intervalId = setInterval(() => {
        setData(prevData => {
          if (prevData.length === 0) return prevData;
          
          const lastPoint = prevData[prevData.length - 1];
          const newTime = lastPoint.time + params.timeStep; // Use visualization time step
          let newPoint: DataPoint = { time: newTime };
          
          try {
            if (selectedModel === 'exponential') {
              const currentN = lastPoint.N || params.N0;
              const result = exponentialGrowthDiscrete(currentN);
              if (isNaN(result) || !isFinite(result)) {
                console.error('Invalid exponential result:', result);
                return prevData;
              }
              newPoint.N = result;
            } else if (selectedModel === 'logistic') {
              const currentN = lastPoint.N || params.N0;
              const result = logisticGrowthDiscrete(currentN);
              if (isNaN(result) || !isFinite(result)) {
                console.error('Invalid logistic result:', result);
                return prevData;
              }
              newPoint.N = result;
            } else if (selectedModel === 'predatorprey') {
              const currentN = lastPoint.N || params.N0;
              const currentP = lastPoint.P || params.P0;
              console.log('Predator-prey input:', { currentN, currentP, timeStep: params.timeStep });
              const result = predatorPreyODE(currentN, currentP, params.timeStep);
              console.log('Predator-prey output:', result);
              if (isNaN(result.N) || isNaN(result.P) || !isFinite(result.N) || !isFinite(result.P)) {
                console.error('Invalid predator-prey result:', result);
                return prevData;
              }
              newPoint.N = result.N;
              newPoint.P = result.P;
            } else if (selectedModel === 'competition') {
              const currentN1 = lastPoint.N1 || params.N1_0;
              const currentN2 = lastPoint.N2 || params.N2_0;
              console.log('Competition input:', { currentN1, currentN2, timeStep: params.timeStep });
              const result = competitionODE(currentN1, currentN2, params.timeStep);
              console.log('Competition output:', result);
              if (isNaN(result.N1) || isNaN(result.N2) || !isFinite(result.N1) || !isFinite(result.N2)) {
                console.error('Invalid competition result:', result);
                return prevData;
              }
              newPoint.N1 = result.N1;
              newPoint.N2 = result.N2;
            }

            console.log('Adding point:', newPoint);
            const newData = [...prevData, newPoint];
            return newData.length > 200 ? newData.slice(-200) : newData;
          } catch (error) {
            console.error('Simulation error:', error, 'Model:', selectedModel, 'LastPoint:', lastPoint);
            return prevData;
          }
        });
        
        setTime(prev => prev + params.timeStep);
      }, Math.max(50, 150 - simulationSpeed));
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, selectedModel, params, simulationSpeed]);

  const resetSimulation = () => {
    setIsPlaying(false);
    setTime(0);
    // Initialize with starting point based on current model
    let initialData: DataPoint = { time: 0 };
    if (selectedModel === 'exponential' || selectedModel === 'logistic') {
      initialData.N = params.N0;
    } else if (selectedModel === 'predatorprey') {
      initialData.N = params.N0;
      initialData.P = params.P0;
    } else if (selectedModel === 'competition') {
      initialData.N1 = params.N1_0;
      initialData.N2 = params.N2_0;
    }
    setData([initialData]);
  };

  // Initialize properly on mount
  useEffect(() => {
    // Force reset when component mounts or model changes
    const initializeData = () => {
      let initialData: DataPoint = { time: 0 };
      if (selectedModel === 'exponential' || selectedModel === 'logistic') {
        initialData.N = params.N0;
      } else if (selectedModel === 'predatorprey') {
        initialData.N = params.N0;
        initialData.P = params.P0;
      } else if (selectedModel === 'competition') {
        initialData.N1 = params.N1_0;
        initialData.N2 = params.N2_0;
      }
      console.log('Initializing with data:', initialData);
      setData([initialData]);
      setTime(0);
      setIsPlaying(false);
    };
    
    if (!useTestData) {
      initializeData();
    }
  }, [selectedModel, useTestData, params.N0, params.P0, params.N1_0, params.N2_0]);

  const addBuilderElement = (type: string) => {
    const newElement = {
      id: Date.now(),
      type,
      x: Math.random() * 400 + 100,
      y: Math.random() * 200 + 100,
      text: type === 'textbox' ? 'Click to edit' : undefined
    };
    setBuilderElements([...builderElements, newElement]);
  };

  const clearBuilder = () => {
    setBuilderElements([]);
  };

  // Drag functionality
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging && dragState.elementId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        
        const newX = Math.max(0, Math.min(dragState.startElementX + deltaX, rect.width - 80));
        const newY = Math.max(50, Math.min(dragState.startElementY + deltaY, rect.height - 80));
        
        setBuilderElements(prev => prev.map(element => 
          element.id === dragState.elementId 
            ? { ...element, x: newX, y: newY }
            : element
        ));
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragState.isDragging) {
        setDragState({ isDragging: false, elementId: null, startX: 0, startY: 0, startElementX: 0, startElementY: 0 });
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragState]);

  const handleMouseDown = (e: React.MouseEvent, elementId: number) => {
    e.preventDefault();
    const element = builderElements.find(el => el.id === elementId);
    if (element) {
      setDragState({
        isDragging: true,
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        startElementX: element.x,
        startElementY: element.y
      });
    }
  };

  // Text editing functionality
  const handleDoubleClick = (e: React.MouseEvent, elementId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const element = builderElements.find(el => el.id === elementId);
    if (element && element.type === 'textbox') {
      setEditingText({ id: elementId, value: element.text || '' });
    }
  };

  const handleTextChange = (value: string) => {
    setEditingText(prev => ({ ...prev, value }));
  };

  const handleTextSave = () => {
    if (editingText.id) {
      setBuilderElements(prev => prev.map(element => 
        element.id === editingText.id 
          ? { ...element, text: editingText.value || 'Click to edit' }
          : element
      ));
      setEditingText({ id: null, value: '' });
    }
  };

  const handleTextCancel = () => {
    setEditingText({ id: null, value: '' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextSave();
    } else if (e.key === 'Escape') {
      handleTextCancel();
    }
  };

  const ModelEquations = () => {
    const equations = {
      exponential: "N(t+1) = N(t) + births - deaths\nN(t+1) = N(t) + bN(t) - dN(t)\nN(t+1) = N(t)(1 + b - d)",
      logistic: "N(t+1) = N(t) + births - deaths\nbirths = bN(t)(1 - N(t)/K)\ndeaths = dN(t)",
      predatorprey: "dN/dt = aN - bNP\ndP/dt = cNP - dP\n\nClassic Lotka-Volterra equations",
      competition: "dN₁/dt = r₁N₁(1 - (N₁ + α₁₂N₂)/K₁)\ndN₂/dt = r₂N₂(1 - (N₂ + α₂₁N₁)/K₂)\n\nLotka-Volterra competition"
    };
    
    return (
      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
        <h3 className="font-bold text-blue-800 mb-2">Model Equations</h3>
        <pre className="text-sm font-mono text-blue-700 whitespace-pre-line">
          {equations[selectedModel]}
        </pre>
      </div>
    );
  };

  const ParameterControls = () => {
    const updateParam = (param: string, value: string) => {
      setParams(prev => ({ ...prev, [param]: parseFloat(value) }));
    };

    return (
      <div className="space-y-4">
        {selectedModel === 'exponential' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Rate (b): {params.birthRate.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.birthRate}
                onChange={(e) => updateParam('birthRate', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Death Rate (d): {params.deathRate.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.deathRate}
                onChange={(e) => updateParam('deathRate', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Population (N₀): {params.N0}
              </label>
              <input
                type="range"
                min="1"
                max="200"
                step="5"
                value={params.N0}
                onChange={(e) => updateParam('N0', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="p-2 bg-blue-50 rounded text-sm">
              <strong>Net Growth Rate (r = b - d): {(params.birthRate - params.deathRate).toFixed(3)}</strong>
            </div>
          </>
        )}

        {selectedModel === 'logistic' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Rate (b): {params.birthRate.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.birthRate}
                onChange={(e) => updateParam('birthRate', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Death Rate (d): {params.deathRate.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.deathRate}
                onChange={(e) => updateParam('deathRate', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carrying Capacity (K): {params.K}
              </label>
              <input
                type="range"
                min="10"
                max="2000"
                step="50"
                value={params.K}
                onChange={(e) => updateParam('K', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Population (N₀): {params.N0}
              </label>
              <input
                type="range"
                min="1"
                max={params.K}
                step="5"
                value={params.N0}
                onChange={(e) => updateParam('N0', e.target.value)}
                className="w-full"
              />
            </div>
          </>
        )}

        {selectedModel === 'predatorprey' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prey Growth Rate (a): {params.a.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={params.a}
                onChange={(e) => updateParam('a', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Predation Rate (b): {params.b.toFixed(4)}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={params.b}
                onChange={(e) => updateParam('b', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Predator Efficiency (c): {params.c.toFixed(4)}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.02"
                step="0.001"
                value={params.c}
                onChange={(e) => updateParam('c', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Predator Death Rate (d): {params.d.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={params.d}
                onChange={(e) => updateParam('d', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="p-2 bg-blue-50 rounded text-sm">
              <strong>Lotka-Volterra Model:</strong><br/>
              dN/dt = aN - bNP<br/>
              dP/dt = cNP - dP<br/>
              <strong>Period ≈ 2π/√(ad) = {(2 * Math.PI / Math.sqrt(params.a * params.d)).toFixed(1)}</strong>
            </div>
          </>
        )}

        {selectedModel === 'competition' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Growth Rate 1 (r₁): {params.r1.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={params.r1}
                  onChange={(e) => updateParam('r1', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Growth Rate 2 (r₂): {params.r2.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={params.r2}
                  onChange={(e) => updateParam('r2', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrying Capacity 1 (K₁): {params.K1}
                </label>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  step="50"
                  value={params.K1}
                  onChange={(e) => updateParam('K1', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrying Capacity 2 (K₂): {params.K2}
                </label>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  step="50"
                  value={params.K2}
                  onChange={(e) => updateParam('K2', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Competition α₁₂: {params.alpha12.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={params.alpha12}
                  onChange={(e) => updateParam('alpha12', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Competition α₂₁: {params.alpha21.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={params.alpha21}
                  onChange={(e) => updateParam('alpha21', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded text-sm">
              <strong>Lotka-Volterra Competition:</strong><br/>
              dN₁/dt = r₁N₁(1 - (N₁ + α₁₂N₂)/K₁)<br/>
              dN₂/dt = r₂N₂(1 - (N₂ + α₂₁N₁)/K₂)
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visualization Time Step: {params.timeStep}
          </label>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            value={params.timeStep}
            onChange={(e) => updateParam('timeStep', e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Larger values = see dynamics faster</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Integration Step (dt): {params.dt}
          </label>
          <input
            type="range"
            min="0.005"
            max="0.1"
            step="0.005"
            value={params.dt}
            onChange={(e) => updateParam('dt', e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Smaller values = more accurate integration</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Simulation Speed: {simulationSpeed}%
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={simulationSpeed}
            onChange={(e) => setSimulationSpeed(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Interactive Population Ecology Teaching Platform
        </h1>
        <p className="text-gray-600">
          Visual model building and dynamic simulations for classroom instruction
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2 flex items-center space-x-2 ${
            activeTab === 'builder'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={20} />
          <span>Concept Builder</span>
        </button>
        <button
          onClick={() => setActiveTab('simulation')}
          className={`px-4 py-2 flex items-center space-x-2 ${
            activeTab === 'simulation'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp size={20} />
          <span>Interactive Simulations</span>
        </button>
      </div>

      {activeTab === 'builder' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Builder Tools */}
          <div className="col-span-3">
            <h3 className="text-lg font-semibold mb-4">Model Elements</h3>
            <div className="space-y-2">
              <button
                onClick={() => addBuilderElement('population')}
                className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 flex items-center space-x-2"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span>Population</span>
              </button>
              <button
                onClick={() => addBuilderElement('arrow-in')}
                className="w-full px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 flex items-center space-x-2"
              >
                <span className="text-blue-600">→</span>
                <span>Flow In</span>
              </button>
              <button
                onClick={() => addBuilderElement('arrow-out')}
                className="w-full px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 flex items-center space-x-2"
              >
                <span className="text-red-600">←</span>
                <span>Flow Out</span>
              </button>
              <button
                onClick={() => addBuilderElement('interaction')}
                className="w-full px-4 py-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 flex items-center space-x-2"
              >
                <span className="text-orange-600">↔</span>
                <span>Interaction</span>
              </button>
              <button
                onClick={() => addBuilderElement('carrying')}
                className="w-full px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 flex items-center space-x-2"
              >
                <div className="w-4 h-4 bg-purple-500 rounded-full border-2 border-purple-600"></div>
                <span>Carrying Capacity</span>
              </button>
              <button
                onClick={() => addBuilderElement('textbox')}
                className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
              >
                <span className="text-gray-600">Aa</span>
                <span>Text Box</span>
              </button>
              <button
                onClick={clearBuilder}
                className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
              >
                Clear Canvas
              </button>
            </div>

            <div className="mt-6">
              <h4 className="text-md font-semibold mb-2">Teaching Flow</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Start with populations (circles)</p>
                <p>• Add flow arrows (births in, deaths out)</p>
                <p>• Include interactions between species</p>
                <p>• Add environmental limits (K)</p>
                <p>• Use text boxes for labels and equations</p>
                <p>• Double-click text boxes to edit</p>
                <p>• Drag elements to show relationships</p>
                <p>• Progress to mathematical equations</p>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="col-span-9">
            <div 
              ref={canvasRef}
              className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 h-96 relative select-none"
            >
              <h3 className="text-lg font-semibold mb-4">Conceptual Whiteboard</h3>
              {builderElements.map((element) => (
                <div key={element.id}>
                  {editingText.id === element.id ? (
                    // Text input for editing
                    <input
                      type="text"
                      value={editingText.value}
                      onChange={(e) => handleTextChange(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onBlur={handleTextSave}
                      autoFocus
                      className="absolute border-2 border-blue-400 rounded px-2 py-1 text-xs bg-white z-20"
                      style={{ 
                        left: element.x, 
                        top: element.y,
                        minWidth: '80px'
                      }}
                    />
                  ) : (
                    // Regular element display
                    <div
                      className={`absolute flex items-center justify-center text-xs font-semibold cursor-move user-select-none ${
                        element.type === 'population'
                          ? 'bg-green-200 text-green-800 border-2 border-green-400 rounded-full w-16 h-16'
                          : element.type === 'arrow-in'
                          ? 'bg-blue-200 text-blue-800 border-2 border-blue-400 rounded-lg w-20 h-8'
                          : element.type === 'arrow-out'
                          ? 'bg-red-200 text-red-800 border-2 border-red-400 rounded-lg w-20 h-8'
                          : element.type === 'interaction'
                          ? 'bg-orange-200 text-orange-800 border-2 border-orange-400 rounded-lg w-16 h-8'
                          : element.type === 'textbox'
                          ? 'bg-white text-gray-800 border-2 border-gray-400 rounded-lg px-3 py-2 min-w-20 max-w-40'
                          : 'bg-purple-200 text-purple-800 border-2 border-purple-400 rounded-lg w-12 h-12'
                      } ${dragState.isDragging && dragState.elementId === element.id ? 'opacity-75 z-10' : ''}`}
                      style={{ left: element.x, top: element.y }}
                      onMouseDown={(e) => handleMouseDown(e, element.id)}
                      onDoubleClick={(e) => handleDoubleClick(e, element.id)}
                    >
                      {element.type === 'population' && 'N(t)'}
                      {element.type === 'arrow-in' && '→ +rN'}
                      {element.type === 'arrow-out' && '← -dN'}
                      {element.type === 'interaction' && '↔ αβ'}
                      {element.type === 'carrying' && 'K'}
                      {element.type === 'textbox' && (
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                          {element.text || 'Click to edit'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {builderElements.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Click elements on the left to build your ecological model conceptually.<br/>
                  Elements can be dragged around the canvas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'simulation' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Controls Panel */}
          <div className="col-span-4">
            <div className="space-y-6">
              {/* Model Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Model Type</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => { setSelectedModel('exponential'); resetSimulation(); }}
                    className={`w-full px-4 py-2 rounded-lg text-left ${
                      selectedModel === 'exponential'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Exponential Growth
                  </button>
                  <button
                    onClick={() => { setSelectedModel('logistic'); resetSimulation(); }}
                    className={`w-full px-4 py-2 rounded-lg text-left ${
                      selectedModel === 'logistic'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Logistic Growth
                  </button>
                  <button
                    onClick={() => { setSelectedModel('predatorprey'); resetSimulation(); }}
                    className={`w-full px-4 py-2 rounded-lg text-left ${
                      selectedModel === 'predatorprey'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Predator-Prey
                  </button>
                  <button
                    onClick={() => { setSelectedModel('competition'); resetSimulation(); }}
                    className={`w-full px-4 py-2 rounded-lg text-left ${
                      selectedModel === 'competition'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Interspecific Competition
                  </button>
                </div>
              </div>

              {/* Simulation Controls */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Simulation Controls</h3>
                
                {/* Test Data Toggle */}
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={useTestData}
                      onChange={(e) => setUseTestData(e.target.checked)}
                      className="form-checkbox"
                    />
                    <span className="text-sm font-medium">Use Test Data (Chart Debug Mode)</span>
                  </label>
                  <p className="text-xs text-yellow-700 mt-1">
                    Toggle this to test if the chart can display curves
                  </p>
                </div>
                
                <div className="flex space-x-2 mb-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                      isPlaying
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center space-x-2"
                  >
                    <RotateCcw size={16} />
                    <span>Reset</span>
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Time: {time.toFixed(1)} | Data Points: {chartData.length}
                  {isPlaying && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">● RUNNING</span>}
                  {!isPlaying && chartData.length > 1 && <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">⏸ PAUSED</span>}
                </p>

                {/* Debug Data Inspector */}
                <div className="mb-4 p-3 bg-gray-50 border rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Data Inspector (Last 3 points)</h4>
                  <div className="text-xs font-mono space-y-1">
                    {chartData.slice(-3).map((point, idx) => (
                      <div key={idx} className="bg-white p-1 rounded">
                        t={point.time?.toFixed(2)} |
                        {point.N !== undefined && ` N=${point.N?.toFixed(1)}`}
                        {point.P !== undefined && ` P=${point.P?.toFixed(1)}`}
                        {point.N1 !== undefined && ` N1=${point.N1?.toFixed(1)}`}
                        {point.N2 !== undefined && ` N2=${point.N2?.toFixed(1)}`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Parameter Controls */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Parameters</h3>
                <ParameterControls />
              </div>

              {/* Equation Display */}
              <div>
                <button
                  onClick={() => setShowEquation(!showEquation)}
                  className="flex items-center space-x-2 mb-3 text-blue-600 hover:text-blue-800"
                >
                  <Settings size={16} />
                  <span>{showEquation ? 'Hide' : 'Show'} Equations</span>
                </button>
                {showEquation && <ModelEquations />}
              </div>
            </div>
          </div>

          {/* Visualization Panel */}
          <div className="col-span-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Population Dynamics</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      type="number"
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis 
                      type="number"
                      domain={[0, 'dataMax']}
                    />
                    <Legend />
                    {(selectedModel === 'exponential' || selectedModel === 'logistic') && (
                      <Line 
                        type="monotone" 
                        dataKey="N" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                        name="Population"
                      />
                    )}
                    {selectedModel === 'predatorprey' && (
                      <>
                        <Line 
                          type="monotone" 
                          dataKey="N" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                          name="Prey"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="P" 
                          stroke="#ef4444" 
                          strokeWidth={3} 
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                          name="Predator"
                        />
                      </>
                    )}
                    {selectedModel === 'competition' && (
                      <>
                        <Line 
                          type="monotone" 
                          dataKey="N1" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                          name="Species 1"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="N2" 
                          stroke="#3b82f6" 
                          strokeWidth={3} 
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                          name="Species 2"
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Phase Plane for Predator-Prey */}
              {selectedModel === 'predatorprey' && chartData.length > 10 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold mb-2">Phase Plane (N vs P)</h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="N" name="Prey (N)" />
                        <YAxis dataKey="P" name="Predator (P)" />
                        <Scatter dataKey="P" fill="#8884d8" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Key Insights */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Biological Interpretation</h4>
                <div className="text-sm text-gray-700">
                  {selectedModel === 'exponential' && (
                    <p>
                      <strong>Discrete exponential growth:</strong> Population grows by birth rate minus death rate each time step. 
                      When birth rate &gt; death rate (r = b - d &gt; 0), population increases geometrically. 
                      This models organisms with distinct breeding seasons or generations.
                    </p>
                  )}
                  {selectedModel === 'logistic' && (
                    <p>
                      <strong>Discrete logistic growth:</strong> Birth rate decreases as population approaches carrying capacity K,
                      while death rate remains constant. This creates density-dependent population regulation 
                      and the characteristic S-shaped growth curve.
                    </p>
                  )}
                  {selectedModel === 'predatorprey' && (
                    <p>
                      <strong>Lotka-Volterra predator-prey model:</strong> Classic oscillatory dynamics with period ≈ {(2 * Math.PI / Math.sqrt(params.a * params.d)).toFixed(1)} time units. 
                      Prey grow exponentially when predators are scarce (rate 'a'), while predation reduces prey (rate 'b'). 
                      Predators convert prey into offspring (efficiency 'c') and die naturally (rate 'd'). 
                      <strong>Watch for the characteristic 90° phase lag</strong> - predator peaks follow prey peaks.
                    </p>
                  )}
                  {selectedModel === 'competition' && (
                    <p>
                      <strong>Lotka-Volterra competition model:</strong> Two species compete for limited resources using logistic growth 
                      modified by interspecific competition. The α coefficients determine competitive strength: if α₁₂ &gt; K₁/K₂, 
                      species 2 excludes species 1. When α₁₂ &lt; K₁/K₂ and α₂₁ &lt; K₂/K₁, both species coexist at stable equilibrium. 
                      Adjust α values to explore competitive exclusion vs. coexistence!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopulationEcologyPlatform;