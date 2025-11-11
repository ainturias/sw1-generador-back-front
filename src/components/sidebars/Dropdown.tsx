import { ChangeEvent, useEffect, useState } from "react";

type DropdownOption = string | { value: string; label: string; icon?: React.ReactNode };

const Dropdown = ({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
}) => {
  const [selectedValue, setSelectedValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue);
    onChange(newValue);
    setIsOpen(false);
  };

  const getOptionValue = (option: DropdownOption): string => {
    return typeof option === "string" ? option : option.value;
  };

  const getOptionLabel = (option: DropdownOption): string => {
    return typeof option === "string" ? option : option.label;
  };

  const getOptionIcon = (option: DropdownOption): React.ReactNode | undefined => {
    return typeof option === "string" ? undefined : option.icon;
  };

  const selectedOption = options.find(opt => getOptionValue(opt) === selectedValue);
  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";
  const selectedIcon = selectedOption ? getOptionIcon(selectedOption) : undefined;

  // Si las opciones tienen iconos, usamos dropdown personalizado
  const hasIcons = options.some(opt => typeof opt !== "string" && opt.icon);

  if (hasIcons) {
    return (
      <div className={`relative ${className ?? ""}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f5f5f5] px-3 py-2 text-xs hover:bg-[#e8e8e8]"
        >
          {selectedIcon && <span className="flex-shrink-0">{selectedIcon}</span>}
          <span className="flex-1 text-left">{selectedLabel}</span>
          <svg
            className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {options.map((option) => {
                const optionValue = getOptionValue(option);
                const optionLabel = getOptionLabel(option);
                const optionIcon = getOptionIcon(option);
                const isSelected = optionValue === selectedValue;
                return (
                  <button
                    key={optionValue}
                    onClick={() => handleChange(optionValue)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                      isSelected ? "bg-blue-50 font-medium text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {optionIcon && <span className="flex-shrink-0">{optionIcon}</span>}
                    <span>{optionLabel}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Sin iconos, usamos select nativo
  return (
    <div className={`relative ${className ?? ""}`}>
      <select
        value={selectedValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-[#e8e8e8] bg-[#f5f5f5] px-2 py-1 text-xs hover:bg-[#e8e8e8]"
      >
        {options.map((option) => {
          const optionValue = getOptionValue(option);
          const optionLabel = getOptionLabel(option);
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default Dropdown;
