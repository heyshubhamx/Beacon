import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

const Input = ({ 
  label, 
  error, 
  className = '', 
  type = 'text', 
  id,
  ...props 
}: InputProps) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <div className="mt-1">
        <input
          id={inputId}
          type={type}
          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
            error ? 'border-red-300' : 'border-gray-300'
          }`}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;