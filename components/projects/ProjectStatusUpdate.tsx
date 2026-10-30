// components/projects/ProjectStatusUpdate.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Eye,
  Loader2,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Award,
  Shield,
  GitBranch,
  DollarSign,
  Users,
  Calendar,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectStatusUpdateProps {
  projectId: string;
  projectName: string;
}

export function ProjectStatusUpdate({ projectId, projectName }: ProjectStatusUpdateProps) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [quickProgress, setQuickProgress] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'recommendations'>('overview');

  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, reportRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/progress`),
        fetch(`/api/projects/${projectId}/status-report`)
      ]);
      
      const statusData = await statusRes.json();
      const reportData = await reportRes.json();
      
      if (statusData.success) setStatusData(statusData.data);
      if (reportData.success) setReportData(reportData.data);
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('Failed to load status data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickUpdate = async () => {
    const percentComplete = parseFloat(quickProgress);
    if (isNaN(percentComplete) || percentComplete < 0 || percentComplete > 100) {
      toast.error('Please enter a valid percentage (0-100)');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentComplete })
      });

      if (!response.ok) throw new Error('Failed to update progress');

      toast.success(`Progress updated to ${percentComplete}%`);
      setQuickProgress('');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to update progress');
    } finally {
      setUpdating(false);
    }
  };

  const getProgressColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBarColor = (value: number) => {
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'GREEN': 'bg-green-100 text-green-700',
      'AMBER': 'bg-yellow-100 text-yellow-700',
      'RED': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
        <p className="text-gray-500 mt-2">Loading status data...</p>
      </div>
    );
  }

  const status = statusData || {};
  const report = reportData || {};
  const summary = report.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Project Status</h2>
          <p className="text-sm text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Download className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={`${(status.percentComplete || 0) * 2.51} 251`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(status.percentComplete || 0)}%</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(report.status?.color || 'GREEN')}`}>
                {report.status?.color === 'GREEN' && <CheckCircle className="w-4 h-4" />}
                {report.status?.color === 'AMBER' && <AlertTriangle className="w-4 h-4" />}
                {report.status?.color === 'RED' && <AlertTriangle className="w-4 h-4" />}
                {report.status?.label || 'On Track'}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Tasks</div>
              <div className="text-xl font-bold">{summary.taskCompletion || 0}/{summary.taskTotal || 0}</div>
              <div className="text-xs text-green-600">Completed</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Budget</div>
              <div className="text-xl font-bold">{formatCurrency(summary.budgetUtilization || 0)}%</div>
              <div className="text-xs text-gray-500">Utilized</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Risks</div>
              <div className="text-xl font-bold text-red-600">{summary.openRisks || 0}</div>
              <div className="text-xs text-gray-500">Open risks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Update */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Quick Update:</span>
          <div className="flex-1 flex items-center gap-2 max-w-md">
            {[25, 50, 75, 100].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setQuickProgress(value.toString());
                  handleQuickUpdate();
                }}
                disabled={updating}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
              >
                {value}%
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              value={quickProgress}
              onChange={(e) => setQuickProgress(e.target.value)}
              placeholder="0-100"
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQuickUpdate();
                }
              }}
              disabled={updating}
            />
            {updating && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600" />}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex" aria-label="Tabs">
            {['overview', 'details', 'recommendations'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Task Progress */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Task Progress</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Completed</span>
                      <span className="font-medium text-green-600">{status.taskStats?.completed || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">In Progress</span>
                      <span className="font-medium text-blue-600">{status.taskStats?.inProgress || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Blocked</span>
                      <span className="font-medium text-red-600">{status.taskStats?.blocked || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Overdue</span>
                      <span className="font-medium text-orange-600">{status.taskStats?.overdue || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Risk Summary</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Risks</span>
                      <span className="font-medium">{status.riskStats?.total || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Critical</span>
                      <span className="font-medium text-red-600">{status.riskStats?.critical || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Open</span>
                      <span className="font-medium text-yellow-600">{status.riskStats?.open || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Closed</span>
                      <span className="font-medium text-green-600">{status.riskStats?.closed || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-gray-50 rounded-lg p-4 col-span-2">
                <h4 className="font-medium text-gray-700 mb-3">Financial Summary</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Budget</div>
                    <div className="font-medium">{formatCurrency(status.project?.budget || 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Spent</div>
                    <div className="font-medium">{formatCurrency(status.project?.actualCost || 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">CPI</div>
                    <div className={`font-medium ${(status.financials?.cpi || 0) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                      {(status.financials?.cpi || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">EAC</div>
                    <div className="font-medium">{formatCurrency(status.financials?.eac || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Project Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className="font-medium">{status.project?.status || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Start Date</span>
                      <span className="font-medium">{status.project?.startDate ? new Date(status.project.startDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">End Date</span>
                      <span className="font-medium">{status.project?.endDate ? new Date(status.project.endDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{Math.round(status.percentComplete || 0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Plan Progress</h4>
                  <div className="space-y-1 text-sm">
                    {status.planStats && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Plans</span>
                          <span className="font-medium">{status.planStats.total || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Completed</span>
                          <span className="font-medium text-green-600">{status.planStats.completed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">In Progress</span>
                          <span className="font-medium text-blue-600">{status.planStats.inProgress || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Avg Progress</span>
                          <span className="font-medium">{Math.round(status.planStats.avgProgress || 0)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress History Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Progress History</h4>
                <div className="h-32 flex items-end gap-2">
                  {(status.history || []).slice(-12).map((item: any, index: number) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className={`w-full rounded-t ${getProgressBarColor(item.percentComplete || 0)}`}
                        style={{ height: `${Math.max(item.percentComplete || 0, 5)}%` }}
                      />
                      <span className="text-xs text-gray-400 mt-1">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {report.recommendations && report.recommendations.length > 0 ? (
                report.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mt-0.5">{rec.includes('✅') ? '✅' : rec.includes('⚠️') ? '⚠️' : '📌'}</div>
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>No recommendations at this time</p>
                  <p className="text-sm">Project is on track</p>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-medium text-blue-700 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Next Steps
                </h4>
                <div className="space-y-2 text-sm text-blue-600">
                  <div>1. Review and prioritize tasks based on critical path</div>
                  <div>2. Update weekly plans based on current progress</div>
                  <div>3. Schedule risk review meeting for open risks</div>
                  <div>4. Prepare weekly status report for stakeholders</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}