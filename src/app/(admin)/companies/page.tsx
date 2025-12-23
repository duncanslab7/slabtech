'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Card, Container } from '@/components';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  account_limit: number | null;
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#f39c12');
  const [formSecondaryColor, setFormSecondaryColor] = useState('#001199');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formAccountLimit, setFormAccountLimit] = useState<string>('');
  const [saveLoading, setSaveLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setCompanies(data);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormName('');
    setFormSlug('');
    setFormPrimaryColor('#f39c12');
    setFormSecondaryColor('#001199');
    setFormLogoUrl('');
    setFormAccountLimit('');
    setShowCreateModal(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormSlug(company.slug);
    setFormPrimaryColor(company.primary_color);
    setFormSecondaryColor(company.secondary_color);
    setFormLogoUrl(company.logo_url || '');
    setFormAccountLimit(company.account_limit?.toString() || '');
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formSlug) {
      alert('Name and slug are required');
      return;
    }

    setSaveLoading(true);
    try {
      const accountLimitValue = formAccountLimit ? parseInt(formAccountLimit) : null;

      if (editingCompany) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update({
            name: formName,
            slug: formSlug,
            primary_color: formPrimaryColor,
            secondary_color: formSecondaryColor,
            logo_url: formLogoUrl || null,
            account_limit: accountLimitValue,
          })
          .eq('id', editingCompany.id);

        if (error) throw error;
      } else {
        // Create new company
        const { error } = await supabase
          .from('companies')
          .insert({
            name: formName,
            slug: formSlug,
            primary_color: formPrimaryColor,
            secondary_color: formSecondaryColor,
            logo_url: formLogoUrl || null,
            account_limit: accountLimitValue,
            is_active: true,
          });

        if (error) throw error;
      }

      setShowCreateModal(false);
      fetchCompanies();
    } catch (error: any) {
      alert(error.message || 'Failed to save company');
    }
    setSaveLoading(false);
  };

  const handleToggleActive = async (company: Company) => {
    const { error } = await supabase
      .from('companies')
      .update({ is_active: !company.is_active })
      .eq('id', company.id);

    if (!error) {
      fetchCompanies();
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading level={1} size="xl" className="text-gray-900">Companies</Heading>
          <Text variant="muted" className="mt-1 text-gray-600">
            Manage companies and their branding
          </Text>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-success-gold text-black font-semibold rounded-lg hover:bg-amber-500"
        >
          + Create Company
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Text variant="muted" className="text-gray-500">No companies found</Text>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Heading level={3} size="lg" className="text-gray-900">{company.name}</Heading>
                    <Text variant="muted" size="sm" className="mt-1 text-gray-500">
                      /{company.slug}
                    </Text>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    company.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {company.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Text variant="muted" size="sm" className="text-gray-600">Primary</Text>
                    <div
                      className="mt-1 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: company.primary_color }}
                    />
                  </div>
                  <div className="flex-1">
                    <Text variant="muted" size="sm" className="text-gray-600">Secondary</Text>
                    <div
                      className="mt-1 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: company.secondary_color }}
                    />
                  </div>
                </div>

                <div>
                  <Text variant="muted" size="sm" className="text-gray-600">Account Limit</Text>
                  <Text className="mt-1 text-gray-900">
                    {company.account_limit ? `${company.account_limit} users` : 'Unlimited'}
                  </Text>
                </div>

                <div className="pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => openEditModal(company)}
                    className="flex-1 px-3 py-2 text-sm bg-success-gold text-black font-medium rounded hover:bg-amber-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(company)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                  >
                    {company.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>

                <Link
                  href={`/c/${company.slug}/dashboard`}
                  className="block text-center text-sm text-success-gold hover:underline"
                >
                  View Dashboard →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-midnight-blue">
                {editingCompany ? 'Edit Company' : 'Create Company'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                  placeholder="Acme Corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug * <span className="text-xs text-gray-500">(lowercase, no spaces)</span>
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                  placeholder="acme-corp"
                />
                <Text variant="muted" size="sm" className="mt-1">
                  Users will access at: /c/{formSlug || 'company-slug'}
                </Text>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <input
                    type="color"
                    value={formPrimaryColor}
                    onChange={(e) => setFormPrimaryColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Color
                  </label>
                  <input
                    type="color"
                    value={formSecondaryColor}
                    onChange={(e) => setFormSecondaryColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Limit <span className="text-xs text-gray-500">(optional - blank for unlimited)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formAccountLimit}
                  onChange={(e) => setFormAccountLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                  placeholder="e.g., 50"
                />
                <Text variant="muted" size="sm" className="mt-1">
                  Maximum number of active users allowed for this company
                </Text>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading || !formName || !formSlug}
                className="flex-1 px-4 py-2 bg-success-gold text-black rounded-lg hover:bg-amber-500 disabled:opacity-50"
              >
                {saveLoading ? 'Saving...' : editingCompany ? 'Save Changes' : 'Create Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
