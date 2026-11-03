import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number; // 0-based index
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const canClick = onStepClick && idx <= currentStep;

          return (
            <li
              key={step.id}
              className={`relative flex-1 flex flex-col items-center ${
                idx !== steps.length - 1 ? 'pr-4 sm:pr-8' : ''
              }`}
            >
              {/* Connector line */}
              {idx !== steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-4 left-1/2 w-full h-[2px] -translate-y-1/2 z-0 ${
                    idx < currentStep ? 'bg-black' : 'bg-black/30'
                  }`}
                />
              )}

              {/* Step indicator circle/square: 2px black border; completed = black, current = saffron, upcoming = white */}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onStepClick(idx)}
                className={`relative z-10 w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs font-bold select-none transition-colors ${
                  isCompleted
                    ? 'bg-black text-white'
                    : isCurrent
                    ? 'bg-saffron text-black shadow-hard-sm'
                    : 'bg-white text-black'
                } ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                ) : (
                  <span className="tabular-nums font-bold">{idx + 1}</span>
                )}
              </button>

              {/* Step Title & Description */}
              <div className="mt-2 text-center">
                <span
                  className={`text-xs block font-heading ${
                    isCurrent
                      ? 'text-black font-extrabold'
                      : isCompleted
                      ? 'text-black font-bold'
                      : 'text-black/60 font-medium'
                  }`}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="hidden sm:block text-[11px] text-ink-muted leading-tight mt-0.5">
                    {step.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
