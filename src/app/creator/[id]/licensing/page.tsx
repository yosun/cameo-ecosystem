'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import LicensingConfig from '@/components/creator/licensing-config';

interface Creator {
  id: string;
  name: string;
  email: string;
  allow_third_party_stores: boolean;
  royalty_bps: number;
  min_price_cents: number;
  max_discount_bps: number;
  status: string;
}

interface PolicyReport {
  creator: {
    id: string;
    name: string;
    licensing: {
      allow_third_party_stores: boolean;
      royalty_bps: number;
      min_price_cents: number;
      max_discount_bps: number;
    };
  };
  products: {
    total: number;
    by_store_type: {
      own_stores: number;
      third_party_stores: number;
    };
    price_distribution: {
      min: number;
      max: number;
      avg: number;
    };
  };
  compliance: {
    all_products_above_min_price: boolean;
    third_party_compliance: boolean;
  };
}

export default function CreatorLicensingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [policyReport, setPolicyReport] = useState<PolicyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchCreatorData();
    }
  }, [params.id]);

  const fetchCreatorData = async () => {
    try {
      const [creatorResponse, reportResponse] = await Promise.all([
        fetch(`/api/creator/${params.id}`),
        fetch(`/api/creator/${params.id}/policy-report`)
      ]);

      if (!creatorResponse.ok) {
        throw new Error('Failed to fetch creator data');
      }

      const creatorData = await creatorResponse.json();
      setCreator(creatorData.creator);

      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        setPolicyReport(reportData.report);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch creator data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLicensingUpdate = async (newConfig: any) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('id', params.id as string);
      formData.append('royalty_bps', newConfig.royalty_bps.toString());
      formData.append('min_price_cents', newConfig.min_price_cents.toString());
      formData.append('max_discount_bps', newConfig.max_discount_bps.toString());
      formData.append('allow_third_party_stores', newConfig.allow_third_party_stores.toString());

      const response = await fetch('/api/creator', {
        method: 'PUT',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update licensing');
      }

      setCreator(data.creator);
      setSuccess('Licensing configuration updated successfully');
      
      // Refresh policy report
      fetchCreatorData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update licensing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnforcePolicy = async () => {
    if (!confirm('This will deactivate any existing products that violate your new licensing terms. Continue?')) {
      return;
    }

    try {
      const response = await fetch(`/api/creator/${params.id}/enforce-policy`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enforce policy');
      }

      setSuccess(`Policy enforced. ${data.products_deactivated} products were deactivated due to violations.`);
      fetchCreatorData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to enforce policy');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading creator licensing...</div>
      </div>
    );
  }

  if (error && !creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Creator not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Licensing Management</h1>
                <p className="mt-1 text-gray-600">Configure licensing terms for {creator.name}</p>
              </div>
              <button
                onClick={() => router.push(`/creator/${creator.id}`)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Back to Profile
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-red-800">{error}</div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="text-green-800">{success}</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Licensing Configuration */}
              <div>
                <LicensingConfig
                  initialConfig={{
                    allow_third_party_stores: creator.allow_third_party_stores,
                    royalty_bps: creator.royalty_bps,
                    min_price_cents: creator.min_price_cents,
                    max_discount_bps: creator.max_discount_bps
                  }}
                  onConfigChange={handleLicensingUpdate}
                  disabled={isSaving}
                />

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleEnforcePolicy}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    disabled={isSaving}
                  >
                    Enforce Policy on Existing Products
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    This will deactivate any existing products that violate your current licensing terms.
                  </p>
                </div>
              </div>

              {/* Policy Report */}
              {policyReport && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Compliance Report</h3>
                  </div>

                  {/* Product Statistics */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Product Statistics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Products:</span>
                        <span className="font-medium">{policyReport.products.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Your Stores:</span>
                        <span className="font-medium">{policyReport.products.by_store_type.own_stores}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Third-party Stores:</span>
                        <span className="font-medium">{policyReport.products.by_store_type.third_party_stores}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Distribution */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Price Distribution</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Minimum Price:</span>
                        <span className="font-medium">${(policyReport.products.price_distribution.min / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Maximum Price:</span>
                        <span className="font-medium">${(policyReport.products.price_distribution.max / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Price:</span>
                        <span className="font-medium">${(policyReport.products.price_distribution.avg / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Status */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Compliance Status</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Price Compliance:</span>
                        <span className={`font-medium ${policyReport.compliance.all_products_above_min_price ? 'text-green-600' : 'text-red-600'}`}>
                          {policyReport.compliance.all_products_above_min_price ? 'Compliant' : 'Violations Found'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Store Policy Compliance:</span>
                        <span className={`font-medium ${policyReport.compliance.third_party_compliance ? 'text-green-600' : 'text-red-600'}`}>
                          {policyReport.compliance.third_party_compliance ? 'Compliant' : 'Violations Found'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Projection */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Revenue Projection</h4>
                    <div className="text-sm text-blue-800">
                      <div>Monthly royalty estimate: ${((policyReport.products.price_distribution.avg * creator.royalty_bps / 10000) * policyReport.products.total * 0.1).toFixed(2)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        * Based on 10% of products selling monthly at average price
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}