
export const ProgressHelpers = {
  getProgressColor(value: number): string {
    if (value >= 70) return 'text-green-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  },

  getProgressBarColor(value: number): string {
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  },

  getRAGStatus(value: number): { label: string; color: string } {
    if (value >= 70) return { label: 'On Track', color: 'bg-green-100 text-green-700' };
    if (value >= 40) return { label: 'At Risk', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Critical', color: 'bg-red-100 text-red-700' };
  },

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  },

  formatPercentage(value: number): string {
    return (value || 0).toFixed(1);
  },

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'INITIATING': 'bg-gray-100 text-gray-700',
      'PLANNING': 'bg-blue-100 text-blue-700',
      'EXECUTING': 'bg-green-100 text-green-700',
      'MONITORING': 'bg-yellow-100 text-yellow-700',
      'CLOSING': 'bg-purple-100 text-purple-700',
      'TODO': 'bg-gray-100 text-gray-700',
      'IN_PROGRESS': 'bg-blue-100 text-blue-700',
      'BLOCKED': 'bg-red-100 text-red-700',
      'COMPLETED': 'bg-green-100 text-green-700',
      'INCOMPLETE': 'bg-orange-100 text-orange-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  },

  getRAGColor(status: string): string {
    switch (status) {
      case 'GREEN': return 'bg-green-100 text-green-700 border-green-200';
      case 'AMBER': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'RED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  },


};