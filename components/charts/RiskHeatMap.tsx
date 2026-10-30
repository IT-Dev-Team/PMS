// components/charts/RiskHeatMap.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RiskHeatMapProps {
  data: Array<{
    probability: number;
    impact: number;
    count: number;
    riskTitles: string[];
  }>;
}

export function RiskHeatMap({ data }: RiskHeatMapProps) {
  const router = useRouter();
  const [selectedCell, setSelectedCell] = useState<{p: number; i: number} | null>(null);

  const getRiskLevel = (p: number, i: number) => {
    const score = p * i;
    if (score >= 20) return { label: 'Critical', color: 'bg-red-600', textColor: 'text-red-600' };
    if (score >= 15) return { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-500' };
    if (score >= 8) return { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-500' };
    return { label: 'Low', color: 'bg-green-500', textColor: 'text-green-500' };
  };

  const getCellColor = (p: number, i: number, count: number) => {
    const maxCount = Math.max(...data.map(d => d.count));
    const intensity = maxCount > 0 ? count / maxCount : 0;
    const baseColor = getRiskLevel(p, i).color;
    return `${baseColor} opacity-${Math.round(intensity * 100)}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">5×5 Risk Matrix</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-600"></div>
            <span className="text-sm">Critical</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500"></div>
            <span className="text-sm">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500"></div>
            <span className="text-sm">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500"></div>
            <span className="text-sm">Low</span>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-sm text-gray-500"></th>
            <th className="p-2 text-sm text-gray-500 text-center" colSpan={5}>Impact</th>
          </tr>
          <tr>
            <th className="p-2 text-sm text-gray-500"></th>
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="p-2 text-sm text-gray-500 text-center">{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((p) => (
            <tr key={p}>
              <td className="p-2 text-sm text-gray-500 font-medium text-right pr-4">{p}</td>
              {[1, 2, 3, 4, 5].map((i) => {
                const cell = data.find(d => d.probability === p && d.impact === i);
                const count = cell?.count || 0;
                const riskLevel = getRiskLevel(p, i);
                const isSelected = selectedCell?.p === p && selectedCell?.i === i;

                return (
                  <td key={`${p}-${i}`} className="p-1">
                    <button
                      onClick={() => {
                        setSelectedCell({ p, i });
                        if (count > 0) {
                          router.push(`/risks?probability=${p}&impact=${i}`);
                        }
                      }}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        count > 0 
                          ? `${riskLevel.color} text-white hover:scale-105` 
                          : 'bg-gray-100 hover:bg-gray-200'
                      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                      disabled={count === 0}
                    >
                      {count > 0 && (
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-lg font-bold">{count}</span>
                          <span className="text-xs opacity-75">risks</span>
                        </div>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="p-2 text-sm text-gray-500 font-medium text-right pr-4">Probability</td>
            <td colSpan={5} className="p-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Low</span>
                <span>High</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {selectedCell && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">
                Probability: {selectedCell.p} | Impact: {selectedCell.i}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Risk Level: <span className={getRiskLevel(selectedCell.p, selectedCell.i).textColor}>
                  {getRiskLevel(selectedCell.p, selectedCell.i).label}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Total Risks: {data.find(d => d.probability === selectedCell.p && d.impact === selectedCell.i)?.count || 0}
              </p>
            </div>
            <button 
              className="text-sm text-blue-600 hover:text-blue-700"
              onClick={() => setSelectedCell(null)}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}