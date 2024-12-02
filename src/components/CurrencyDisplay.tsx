import { useState } from 'react';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import platinumIcon from '/icons/platinum.svg';
import goldIcon from '/icons/gold.svg';
import silverIcon from '/icons/silver.svg';
import copperIcon from '/icons/copper.svg';

interface Currency {
  type: 'copper' | 'silver' | 'gold' | 'platinum';
  amount: number;
}

interface CurrencyDisplayProps {
  currencies: Currency[];
  isDM: boolean;
  onUpdate?: (currencies: Currency[]) => void;
}

export function CurrencyDisplay({ currencies, isDM, onUpdate }: CurrencyDisplayProps) {
  const [editValues, setEditValues] = useState<{ [key: string]: string }>(
    currencies.reduce((acc, curr) => ({
      ...acc,
      [curr.type]: "1"
    }), {})
  );

  const currencyIcons = {
    copper: copperIcon,
    silver: silverIcon,
    gold: goldIcon,
    platinum: platinumIcon
  };

  const currencySymbols = {
    copper: 'C-Coins',
    silver: 'S-Coins',
    gold: 'G-Coins',
    platinum: 'P-Coins'
  };

  const handleQuantityChange = (type: Currency['type'], change: number) => {
    const newCurrencies = currencies.map(currency => {
      if (currency.type === type) {
        const newAmount = Math.max(0, currency.amount + change);
        return { ...currency, amount: newAmount };
      }
      return currency;
    });
    onUpdate?.(newCurrencies);
  };

  const handleInputChange = (type: Currency['type'], value: string) => {
    setEditValues(prev => ({
      ...prev,
      [type]: value
    }));
  };

  return (
    <div className="bg-black/20 rounded-lg p-3 mb-4">
      <div className="flex flex-wrap justify-between gap-2">
        {currencies.map((currency) => (
          <div key={currency.type} className="flex items-center gap-2">
            <img 
              src={currencyIcons[currency.type]} 
              alt={currency.type}
              className="w-8 h-8"
            />
            <span className="text-sm text-gray-400 w-24">{currencySymbols[currency.type]}</span>
            <span className="w-16 text-right">{currency.amount}</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min="1"
                value={editValues[currency.type]}
                onChange={(e) => handleInputChange(currency.type, e.target.value)}
                className="w-16 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                placeholder="1"
              />
              {isDM && (
                <button
                  onClick={() => handleQuantityChange(
                    currency.type,
                    parseInt(editValues[currency.type] || '0')
                  )}
                  className="p-1 bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleQuantityChange(
                  currency.type,
                  -parseInt(editValues[currency.type] || '1')
                )}
                className="p-1 bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 rounded"
              >
                <MinusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 