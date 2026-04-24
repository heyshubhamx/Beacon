import React from 'react';
import { Label } from '../ui/label';

interface FormFieldProps {
  id?: string;
  label: string;
  children: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  children,
  description,
  required
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {id ? (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        ) : (
          <span className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
};

export default FormField; 