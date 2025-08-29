'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface WebhookStats {
  total: number;
  completed: number;
  failed: number;
  deadLetter: number;
  processing: number;
  successRate: number;
}

interface WebhookFailure {
  id: string;
  source: string;
  event_type: string;
  retry_count: number;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface DeadLetterItem {
  id: string;
  webhook_event_id: string;
  final_error: string;
  reviewed: boolean;
  created_at: string;
  webhook_event: {
    id: string;
    source: string;
    event_type: string;
    retry_count: number;
    created_at: string;
  };
}

export function WebhookMonitor() {
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [failures, setFailures] = useState<WebhookFailure[]>([]);
  const [deadLetterQueue, setDeadLetterQueue] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);

  useEffect(() => {
    loadWebhookData();
  }, []);

  const loadWebhookData = async () => {
    try {
      setLoading(true);
      
      const [statsRes, failuresRes, deadLetterRes] = await Promise.all([
        fetch('/api/admin/webhooks?action=stats'),
        fetch('/api/admin/webhooks?action=failures&limit=20'),
        fetch('/api/admin/webhooks?action=dead-letter'),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      
      if (failuresRes.ok) {
        setFailures(await failuresRes.json());
      }
      
      if (deadLetterRes.ok) {
        setDeadLetterQueue(await deadLetterRes.json());
      }
    } catch (error) {
      console.error('Failed to load webhook data:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryAllWebhooks = async () => {
    try {
      setRetryLoading(true);
      
      const response = await fetch('/api/admin/webhooks/retry', {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Retry processing completed: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
        loadWebhookData(); // Refresh data
      } else {
        alert('Failed to trigger webhook retry processing');
      }
    } catch (error) {
      console.error('Failed to retry webhooks:', error);
      alert('Failed to trigger webhook retry processing');
    } finally {
      setRetryLoading(false);
    }
  };

  const retryWebhook = async (webhookId: string) => {
    try {
      const response = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', webhookId }),
      });
      
      if (response.ok) {
        alert('Webhook queued for retry');
        loadWebhookData(); // Refresh data
      } else {
        alert('Failed to retry webhook');
      }
    } catch (error) {
      console.error('Failed to retry webhook:', error);
      alert('Failed to retry webhook');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'dead_letter':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Dead Letter</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const colors = {
      STRIPE: 'bg-purple-100 text-purple-800',
      FAL: 'bg-blue-100 text-blue-800',
      REPLICATE: 'bg-green-100 text-green-800',
    };
    
    return (
      <Badge className={colors[source as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {source}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading webhook data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Webhook Monitor</h2>
        <div className="flex gap-2">
          <Button onClick={loadWebhookData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={retryAllWebhooks} 
            disabled={retryLoading}
            size="sm"
          >
            {retryLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Retry All Failed
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.successRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dead Letter</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.deadLetter}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Views */}
      <Tabs defaultValue="failures" className="w-full">
        <TabsList>
          <TabsTrigger value="failures">Recent Failures</TabsTrigger>
          <TabsTrigger value="dead-letter">Dead Letter Queue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Failures</CardTitle>
            </CardHeader>
            <CardContent>
              {failures.length === 0 ? (
                <p className="text-muted-foreground">No recent failures</p>
              ) : (
                <div className="space-y-4">
                  {failures.map((failure) => (
                    <div key={failure.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getSourceBadge(failure.source)}
                          {getStatusBadge(failure.status)}
                          <span className="text-sm font-medium">{failure.event_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Retry {failure.retry_count}/3
                          </span>
                          {failure.status === 'failed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => retryWebhook(failure.id)}
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {failure.error_message && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {failure.error_message}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(failure.created_at).toLocaleString()} | 
                        Updated: {new Date(failure.updated_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="dead-letter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dead Letter Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {deadLetterQueue.length === 0 ? (
                <p className="text-muted-foreground">No items in dead letter queue</p>
              ) : (
                <div className="space-y-4">
                  {deadLetterQueue.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getSourceBadge(item.webhook_event.source)}
                          <span className="text-sm font-medium">
                            {item.webhook_event.event_type}
                          </span>
                          {item.reviewed && (
                            <Badge variant="outline">Reviewed</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Final retry count: {item.webhook_event.retry_count}
                        </span>
                      </div>
                      
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
                        {item.final_error}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Original: {new Date(item.webhook_event.created_at).toLocaleString()} | 
                        Dead Letter: {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}