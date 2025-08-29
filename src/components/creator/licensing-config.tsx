'use client';

import { useState } from 'react';

interface LicensingConfig {
  allow_third_party_stores: boolean;
  royalty_bps: number;
  min_price_cents: number;
  max_discount_bps: number;
}

interface LicensingConfigProps {
  initialConfig: LicensingConfig;
  onConfigChange: (config: LicensingConfig) => void;
  disabled?: boolean;
}

export default function LicensingConfig({ 
  initialConfig, 
  onConfigChange, 
  disabled = false 
}: LicensingConfigProps) {
  const [config, setConfig] = useState<LicensingConfig>(initialConfig);

  const handleChange = (field: keyof LicensingConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatPercentage = (bps: number) => {
    return `${(bps / 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Licensing Configuration</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure how others can use your LoRA and what royalties you'll receive from sales.
        </p>
      </div>

      {/* Third-party store permission */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="allow_third_party_stores"
            checked={config.allow_third_party_stores}
            onChange={(e) => handleChange('allow_third_party_stores', e.target.checked)}
            disabled={disabled}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
          />
          <div className="flex-1">
            <label htmlFor="allow_third_party_stores" className="block text-sm font-medium text-gray-900">
              Allow third-party stores
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Let other users create stores and sell products using your LoRA. If disabled, only you can create products with your LoRA.
            </p>
          </div>
        </div>
      </div>

      {/* Royalty percentage */}
      <div>
        <label htmlFor="royalty_bps" className="block text-sm font-medium text-gray-700 mb-2">
          Royalty Rate: {formatPercentage(config.royalty_bps)}
        </label>
        <div className="space-y-2">
          <input
            type="range"
            id="royalty_bps"
            min="500"
            max="5000"
            step="100"
            value={config.royalty_bps}
            onChange={(e) => handleChange('royalty_bps', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>5%</span>
            <span>50%</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Percentage of each sale you'll receive as royalty. Higher rates may discourage store owners from listing your products.
        </p>
      </div>

      {/* Minimum price */}
      <div>
        <label htmlFor="min_price_cents" className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Price: {formatCurrency(config.min_price_cents)}
        </label>
        <div className="space-y-2">
          <input
            type="range"
            id="min_price_cents"
            min="100"
            max="10000"
            step="100"
            value={config.min_price_cents}
            onChange={(e) => handleChange('min_price_cents', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>$1.00</span>
            <span>$100.00</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Minimum price that products using your LoRA can be sold for. This ensures your work maintains a certain value.
        </p>
      </div>

      {/* Maximum discount */}
      <div>
        <label htmlFor="max_discount_bps" className="block text-sm font-medium text-gray-700 mb-2">
          Maximum Discount: {formatPercentage(config.max_discount_bps)}
        </label>
        <div className="space-y-2">
          <input
            type="range"
            id="max_discount_bps"
            min="0"
            max="5000"
            step="100"
            value={config.max_discount_bps}
            onChange={(e) => handleChange('max_discount_bps', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Maximum discount that can be applied to products using your LoRA. This prevents excessive price reductions.
        </p>
      </div>

      {/* Revenue calculation example */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Revenue Example</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>Product sold at minimum price: {formatCurrency(config.min_price_cents)}</div>
          <div>Your royalty ({formatPercentage(config.royalty_bps)}): {formatCurrency(Math.floor(config.min_price_cents * config.royalty_bps / 10000))}</div>
          <div>Store owner gets: {formatCurrency(config.min_price_cents - Math.floor(config.min_price_cents * config.royalty_bps / 10000) - Math.floor(config.min_price_cents * 0.1))}</div>
          <div className="text-xs text-blue-600 mt-2">
            * Platform fee (10%) and payment processing fees not included in this example
          </div>
        </div>
      </div>

      {/* Policy summary */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Current Policy Summary</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>
            • Third-party stores: {config.allow_third_party_stores ? 'Allowed' : 'Not allowed'}
          </li>
          <li>
            • Royalty rate: {formatPercentage(config.royalty_bps)} per sale
          </li>
          <li>
            • Minimum price: {formatCurrency(config.min_price_cents)}
          </li>
          <li>
            • Maximum discount: {formatPercentage(config.max_discount_bps)}
          </li>
        </ul>
      </div>
    </div>
  );
}