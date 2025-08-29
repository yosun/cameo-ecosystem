import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerationInterface } from '../generation/generation-interface';

// Mock components
jest.mock('../generation/photo-mode', () => ({
  PhotoMode: ({ onGenerate }: { onGenerate: (data: any) => void }) => (
    <div data-testid="photo-mode">
      <button onClick={() => onGenerate({ mode: 'photo', scene_url: 'test.jpg' })}>
        Generate Photo
      </button>
    </div>
  ),
}));

jest.mock('../generation/text-mode', () => ({
  TextMode: ({ onGenerate }: { onGenerate: (data: any) => void }) => (
    <div data-testid="text-mode">
      <button onClick={() => onGenerate({ mode: 'text', prompt: 'test prompt' })}>
        Generate Text
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockCreator = {
  id: 'creator-1',
  name: 'Test Creator',
  status: 'READY' as const,
  lora_url: 'https://example.com/lora.safetensors',
  trigger_word: 'testcreator',
};

describe('GenerationInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render mode selection tabs', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByRole('tab', { name: /photo mode/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /text mode/i })).toBeInTheDocument();
  });

  it('should show photo mode by default', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByTestId('photo-mode')).toBeInTheDocument();
    expect(screen.queryByTestId('text-mode')).not.toBeInTheDocument();
  });

  it('should switch to text mode when tab is clicked', () => {
    render(<GenerationInterface creator={mockCreator} />);

    const textModeTab = screen.getByRole('tab', { name: /text mode/i });
    fireEvent.click(textModeTab);

    expect(screen.getByTestId('text-mode')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-mode')).not.toBeInTheDocument();
  });

  it('should handle photo mode generation', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generation: {
          id: 'generation-1',
          status: 'PROCESSING',
        },
      }),
    });

    render(<GenerationInterface creator={mockCreator} />);

    const generateButton = screen.getByText('Generate Photo');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: 'creator-1',
          mode: 'photo',
          scene_url: 'test.jpg',
          nsfw: false,
        }),
      });
    });
  });

  it('should handle text mode generation', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generation: {
          id: 'generation-2',
          status: 'PROCESSING',
        },
      }),
    });

    render(<GenerationInterface creator={mockCreator} />);

    // Switch to text mode
    const textModeTab = screen.getByRole('tab', { name: /text mode/i });
    fireEvent.click(textModeTab);

    const generateButton = screen.getByText('Generate Text');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: 'creator-1',
          mode: 'text',
          prompt: 'test prompt',
          nsfw: false,
        }),
      });
    });
  });

  it('should show loading state during generation', async () => {
    // Mock a delayed response
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ generation: { id: 'generation-1' } }),
      }), 100))
    );

    render(<GenerationInterface creator={mockCreator} />);

    const generateButton = screen.getByText('Generate Photo');
    fireEvent.click(generateButton);

    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
  });

  it('should handle generation errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Content safety violation detected',
      }),
    });

    render(<GenerationInterface creator={mockCreator} />);

    const generateButton = screen.getByText('Generate Photo');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/content safety violation detected/i)).toBeInTheDocument();
    });
  });

  it('should display creator information', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByText('Test Creator')).toBeInTheDocument();
    expect(screen.getByText(/trigger word: testcreator/i)).toBeInTheDocument();
  });

  it('should show creator status', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByText(/ready/i)).toBeInTheDocument();
  });

  it('should disable generation when creator is not ready', () => {
    const notReadyCreator = {
      ...mockCreator,
      status: 'TRAINING' as const,
    };

    render(<GenerationInterface creator={notReadyCreator} />);

    expect(screen.getByText(/training in progress/i)).toBeInTheDocument();
    
    const generateButton = screen.getByText('Generate Photo');
    expect(generateButton).toBeDisabled();
  });

  it('should show NSFW toggle', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByLabelText(/allow nsfw content/i)).toBeInTheDocument();
  });

  it('should include NSFW setting in generation request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ generation: { id: 'generation-1' } }),
    });

    render(<GenerationInterface creator={mockCreator} />);

    // Enable NSFW
    const nsfwToggle = screen.getByLabelText(/allow nsfw content/i);
    fireEvent.click(nsfwToggle);

    const generateButton = screen.getByText('Generate Photo');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: 'creator-1',
          mode: 'photo',
          scene_url: 'test.jpg',
          nsfw: true, // Should be true now
        }),
      });
    });
  });

  it('should show generation history', () => {
    render(<GenerationInterface creator={mockCreator} />);

    expect(screen.getByText(/recent generations/i)).toBeInTheDocument();
  });

  it('should handle network errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<GenerationInterface creator={mockCreator} />);

    const generateButton = screen.getByText('Generate Photo');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
    });
  });
});