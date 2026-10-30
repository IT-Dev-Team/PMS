// components/portfolio/PortfolioRegistration.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  DollarSign,
  Users,
  Briefcase,
  FileText,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  Phone,
  Mail,
  Link,
  Layers,
  Target,
  Award,
  TrendingUp,
  Shield,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PortfolioRegistrationProps {
  userId: string;
  onClose?: () => void;   // ← NEW
}

export function PortfolioRegistration({ userId, onClose }: PortfolioRegistrationProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: '',
    code: '',
    description: '',
    type: 'PROGRAM', // PROGRAM, PORTFOLIO, MEGA_PROJECT
    industry: '',
    sector: '',
    
    // Step 2: Strategic Information
    objective: '',
    strategicAlignment: '',
    businessCase: '',
    expectedBenefits: [''],
    investmentAmount: '',
    currency: 'USD',
    
    // Step 3: Timeline & Resources
    startDate: '',
    endDate: '',
    estimatedDuration: '',
    resourceRequirements: [''],
    keyStakeholders: [''],
    
    // Step 4: Governance
    sponsorName: '',
    sponsorEmail: '',
    governanceStructure: '',
    reportingRequirements: '',
    approvalProcess: '',
    
    // Step 5: Review & Submit
    reviewNotes: '',
    confirmAccuracy: false
  });

  const steps = [
    { id: 1, label: 'Basic Information', icon: Building2 },
    { id: 2, label: 'Strategic Information', icon: Target },
    { id: 3, label: 'Timeline & Resources', icon: Calendar },
    { id: 4, label: 'Governance', icon: Shield },
    { id: 5, label: 'Review & Submit', icon: CheckCircle }
  ];

  // Calculate min and max dates based on current date
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    return maxDate.toISOString().split('T')[0];
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayField = (field: string, index: number, value: string) => {
    setFormData(prev => {
      const newArray = [...(prev[field as keyof typeof prev] as string[])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const handleAddArrayItem = (field: string) => {
    setFormData(prev => {
      const newArray = [...(prev[field as keyof typeof prev] as string[]), ''];
      return { ...prev, [field]: newArray };
    });
  };

  const handleRemoveArrayItem = (field: string, index: number) => {
    setFormData(prev => {
      const newArray = (prev[field as keyof typeof prev] as string[]).filter((_, i) => i !== index);
      return { ...prev, [field]: newArray };
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name) { setError('Portfolio name is required'); return false; }
        if (!formData.code) { setError('Portfolio code is required'); return false; }
        if (!formData.type) { setError('Portfolio type is required'); return false; }
        break;
      case 2:
        if (!formData.objective) { setError('Strategic objective is required'); return false; }
        break;
      case 5:
        if (!formData.confirmAccuracy) { setError('Please confirm accuracy of information'); return false; }
        break;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(5)) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare data for submission
      const submissionData = {
        ...formData,
        createdBy: userId,
        investmentAmount: parseFloat(formData.investmentAmount) || 0,
        expectedBenefits: formData.expectedBenefits.filter(b => b.trim()),
        resourceRequirements: formData.resourceRequirements.filter(r => r.trim()),
        keyStakeholders: formData.keyStakeholders.filter(s => s.trim()),
        // If startDate or endDate are empty, use min/max dates
        startDate: formData.startDate || getMinDate(),
        endDate: formData.endDate || getMaxDate()
      };

      const response = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to register portfolio');
      }

      toast.success('Portfolio registered successfully!');
       onClose?.();      
      router.push(`/dashboard`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to register portfolio');
      toast.error('Failed to register portfolio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Progress Steps */}
       <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div 
                className={`flex items-center gap-2 cursor-pointer ${
                  step >= s.id ? 'text-blue-600' : 'text-gray-400'
                }`}
                onClick={() => {
                  if (step > s.id || step === s.id + 1) {
                    setStep(s.id);
                  }
                }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.id ? 'bg-green-500 text-white' :
                  step === s.id ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
                </div>
                <span className={`text-sm hidden sm:block ${
                  step >= s.id ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}>
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  step > s.id ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Basic Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio/Program Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cement Plant Expansion Program"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CEM-PROG-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the purpose and scope of this portfolio/program"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PORTFOLIO">Portfolio</option>
                  <option value="PROGRAM">Program</option>
                  <option value="MEGA_PROJECT">Mega Project</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Construction, Manufacturing"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Strategic Information */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strategic Objective *
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => handleChange('objective', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What is the main strategic objective of this portfolio?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investment Amount 
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.investmentAmount}
                    onChange={(e) => handleChange('investmentAmount', e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Benefits
              </label>
              {formData.expectedBenefits.map((benefit, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={benefit}
                    onChange={(e) => handleArrayField('expectedBenefits', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Benefit ${index + 1}`}
                  />
                  {formData.expectedBenefits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('expectedBenefits', index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem('expectedBenefits')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Benefit
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Timeline & Resources */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If not provided, today's date will be used
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  min={formData.startDate || getMinDate()}
                  max={getMaxDate()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If not provided, a date 10 years from now will be used
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resource Requirements
              </label>
              {formData.resourceRequirements.map((resource, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={resource}
                    onChange={(e) => handleArrayField('resourceRequirements', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Resource ${index + 1}`}
                  />
                  {formData.resourceRequirements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('resourceRequirements', index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem('resourceRequirements')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Resource
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Governance */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sponsor Name *
                </label>
                <input
                  type="text"
                  value={formData.sponsorName}
                  onChange={(e) => handleChange('sponsorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name of sponsor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sponsor Email 
                </label>
                <input
                  type="email"
                  value={formData.sponsorEmail}
                  onChange={(e) => handleChange('sponsorEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sponsor@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Governance Structure
              </label>
              <textarea
                value={formData.governanceStructure}
                onChange={(e) => handleChange('governanceStructure', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the governance structure for this portfolio"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reporting Requirements
              </label>
              <textarea
                value={formData.reportingRequirements}
                onChange={(e) => handleChange('reportingRequirements', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe reporting requirements and frequency"
              />
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Review Portfolio Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Portfolio Name</div>
                  <div className="font-medium">{formData.name || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Portfolio Code</div>
                  <div className="font-medium">{formData.code || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Type</div>
                  <div className="font-medium">{formData.type || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Industry</div>
                  <div className="font-medium">{formData.industry || 'Not provided'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-500">Strategic Objective</div>
                  <div className="font-medium">{formData.objective || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Investment Amount</div>
                  <div className="font-medium">
                    {formData.investmentAmount ? `$${parseFloat(formData.investmentAmount).toLocaleString()}` : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Currency</div>
                  <div className="font-medium">{formData.currency || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Timeline</div>
                  <div className="font-medium">
                    {formData.startDate || formData.endDate ? 
                      `${formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'Today'} - ${formData.endDate ? new Date(formData.endDate).toLocaleDateString() : '10 years from now'}` : 
                      'Not provided (will use defaults)'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Sponsor</div>
                  <div className="font-medium">{formData.sponsorName || 'Not provided'}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.reviewNotes}
                onChange={(e) => handleChange('reviewNotes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes or comments"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.confirmAccuracy}
                onChange={(e) => handleChange('confirmAccuracy', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700">
                I confirm that all information provided is accurate and complete
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleBack}
            className={`px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
              step === 1 ? 'invisible' : ''
            }`}
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Register Portfolio
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}