import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorProfileForm } from '../creator/creator-profile-form';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('CreatorProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render form fields correctly', () => {
    render(<CreatorProfileForm />);

    expect(screen.getByLabelText(/creator name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload images/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/consent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/allow third-party stores/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/royalty percentage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minimum price/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create creator profile/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<CreatorProfileForm />);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/creator name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/at least 5 images are required/i)).toBeInTheDocument();
      expect(screen.getByText(/consent is required/i)).toBeInTheDocument();
    });
  });

  it('should validate image count', async () => {
    render(<CreatorProfileForm />);

    const nameInput = screen.getByLabelText(/creator name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Creator' } });

    // Mock file input with insufficient images
    const fileInput = screen.getByLabelText(/upload images/i);
    const mockFiles = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
    ]; // Only 2 images, need 5

    Object.defineProperty(fileInput, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(fileInput);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 5 images are required/i)).toBeInTheDocument();
    });
  });

  it('should validate image file types', async () => {
    render(<CreatorProfileForm />);

    const nameInput = screen.getByLabelText(/creator name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Creator' } });

    // Mock file input with invalid file type
    const fileInput = screen.getByLabelText(/upload images/i);
    const mockFiles = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      new File(['test3'], 'test3.jpg', { type: 'image/jpeg' }),
      new File(['test4'], 'test4.jpg', { type: 'image/jpeg' }),
      new File(['test5'], 'test5.txt', { type: 'text/plain' }), // Invalid type
    ];

    Object.defineProperty(fileInput, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(fileInput);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/only image files are allowed/i)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        creator: {
          id: 'creator-1',
          name: 'Test Creator',
          status: 'TRAINING',
        },
      }),
    });

    render(<CreatorProfileForm />);

    // Fill form fields
    const nameInput = screen.getByLabelText(/creator name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Creator' } });

    const consentCheckbox = screen.getByLabelText(/consent/i);
    fireEvent.click(consentCheckbox);

    const allowStoresCheckbox = screen.getByLabelText(/allow third-party stores/i);
    fireEvent.click(allowStoresCheckbox);

    const royaltyInput = screen.getByLabelText(/royalty percentage/i);
    fireEvent.change(royaltyInput, { target: { value: '10' } });

    const minPriceInput = screen.getByLabelText(/minimum price/i);
    fireEvent.change(minPriceInput, { target: { value: '5.00' } });

    // Mock file input with valid images
    const fileInput = screen.getByLabelText(/upload images/i);
    const mockFiles = Array.from({ length: 5 }, (_, i) => 
      new File([`test${i + 1}`], `test${i + 1}.jpg`, { type: 'image/jpeg' })
    );

    Object.defineProperty(fileInput, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(fileInput);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/creator', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/creator/creator-1');
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Creator with this email already exists',
      }),
    });

    render(<CreatorProfileForm />);

    // Fill form with valid data
    const nameInput = screen.getByLabelText(/creator name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Creator' } });

    const consentCheckbox = screen.getByLabelText(/consent/i);
    fireEvent.click(consentCheckbox);

    const fileInput = screen.getByLabelText(/upload images/i);
    const mockFiles = Array.from({ length: 5 }, (_, i) => 
      new File([`test${i + 1}`], `test${i + 1}.jpg`, { type: 'image/jpeg' })
    );

    Object.defineProperty(fileInput, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(fileInput);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/creator with this email already exists/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    // Mock a delayed response
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ creator: { id: 'creator-1' } }),
      }), 100))
    );

    render(<CreatorProfileForm />);

    // Fill form with valid data
    const nameInput = screen.getByLabelText(/creator name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Creator' } });

    const consentCheckbox = screen.getByLabelText(/consent/i);
    fireEvent.click(consentCheckbox);

    const fileInput = screen.getByLabelText(/upload images/i);
    const mockFiles = Array.from({ length: 5 }, (_, i) => 
      new File([`test${i + 1}`], `test${i + 1}.jpg`, { type: 'image/jpeg' })
    );

    Object.defineProperty(fileInput, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(fileInput);

    const submitButton = screen.getByRole('button', { name: /create creator profile/i });
    fireEvent.click(submitButton);

    // Check for loading state
    expect(screen.getByText(/creating profile/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should validate royalty percentage range', async () => {
    render(<CreatorProfileForm />);

    const royaltyInput = screen.getByLabelText(/royalty percentage/i);
    
    // Test invalid high value
    fireEvent.change(royaltyInput, { target: { value: '101' } });
    fireEvent.blur(royaltyInput);

    await waitFor(() => {
      expect(screen.getByText(/royalty percentage must be between 0 and 100/i)).toBeInTheDocument();
    });

    // Test invalid negative value
    fireEvent.change(royaltyInput, { target: { value: '-5' } });
    fireEvent.blur(royaltyInput);

    await waitFor(() => {
      expect(screen.getByText(/royalty percentage must be between 0 and 100/i)).toBeInTheDocument();
    });
  });

  it('should validate minimum price format', async () => {
    render(<CreatorProfileForm />);

    const minPriceInput = screen.getByLabelText(/minimum price/i);
    
    // Test invalid format
    fireEvent.change(minPriceInput, { target: { value: 'invalid' } });
    fireEvent.blur(minPriceInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid price/i)).toBeInTheDocument();
    });

    // Test negative value
    fireEvent.change(minPriceInput, { target: { value: '-5.00' } });
    fireEvent.blur(minPriceInput);

    await waitFor(() => {
      expect(screen.getByText(/minimum price must be positive/i)).toBeInTheDocument();
    });
  });
});