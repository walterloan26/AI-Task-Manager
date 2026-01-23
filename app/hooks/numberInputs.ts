// hooks/useNumberInput.ts
import { useState, useEffect } from 'react';

export function useNumberInput(
  initialValue: number,
  onChange: (value: number) => void
) {
  const [stringValue, setStringValue] = useState(String(initialValue));

  // Sync with external value
  useEffect(() => {
    setStringValue(String(initialValue));
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty string or valid numbers
    if (value === '' || /^\d*$/.test(value)) {
      setStringValue(value);
    }
  };

  const handleBlur = () => {
    const numValue = stringValue === '' ? 0 : parseInt(stringValue, 10);
    
    // Only update if value changed
    if (!isNaN(numValue) && numValue !== initialValue) {
      onChange(numValue);
    } else {
      // Reset to original value if invalid
      setStringValue(String(initialValue));
    }
  };

  return {
    stringValue,
    handleChange,
    handleBlur,
  };
}