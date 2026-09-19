import React from 'react';
import { CallStatus, DecisionType } from '../../types';

interface BadgeProps {
  status?: CallStatus;
  decision?: DecisionType;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<{ status: CallStatus; size?: 'sm' | 'md' | 'lg' }> = ({
  status,
  size = 'md'
}) => {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm font-semibold' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'ACTIVE':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-[#E8F8F0] text-[#059669] border border-[#A7F3D0] ${sizeClasses}`}>
          Active
        </span>
      );
    case 'ANALYZING':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-200 ${sizeClasses}`}>
          Analyzing
        </span>
      );
    case 'CONNECTING':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}>
          Connecting
        </span>
      );
    case 'COMPLETED':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-purple-50 text-purple-600 border border-purple-200 ${sizeClasses}`}>
          Completed
        </span>
      );
    case 'FAILED':
    case 'INTERRUPTED':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-rose-50 text-rose-600 border border-rose-200 ${sizeClasses}`}>
          {status}
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-600 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

export const DecisionBadge: React.FC<{ decision: DecisionType; size?: 'sm' | 'md' | 'lg' }> = ({
  decision,
  size = 'md'
}) => {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-4 py-1.5 text-sm font-semibold' : 'px-3 py-1 text-xs';

  switch (decision) {
    case 'HUMAN':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-[#E8F8F0] text-[#059669] border border-[#A7F3D0] ${sizeClasses}`}>
          Human
        </span>
      );
    case 'AI_GENERATED':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] ${sizeClasses}`}>
          AI Generated
        </span>
      );
    case 'UNCERTAIN':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] ${sizeClasses}`}>
          Uncertain
        </span>
      );
    case 'NO_DECISION':
    case '--':
    default:
      return (
        <span className="text-slate-400 font-semibold px-2">
          --
        </span>
      );
  }
};
