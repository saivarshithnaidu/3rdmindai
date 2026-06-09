import { useState, useEffect, useRef } from 'react';
import { StreamEvent } from '../types';

export function useStream(projectId: string | null | undefined) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!projectId) {
      setEvents([]);
      setConnected(false);
      return;
    }

    // Load initial events from DB first
    fetch(`/api/stream/events?projectId=${projectId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.events)) {
          setEvents(data.events.slice(-200));
        }
      })
      .catch((err) => console.warn('Failed to load initial stream events:', err));

    function connect() {
      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(`/api/stream/${projectId}`);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (e) => {
        if (e.data === ': ping') return;
        try {
          const event: StreamEvent = JSON.parse(e.data);
          setEvents((prev) => {
            // Check if we already have this event to prevent duplicates on reconnect
            if (prev.some((existing) => existing.id === event.id)) {
              return prev;
            }
            const updated = [...prev, event];
            return updated.slice(-200);
          });
        } catch (err) {
          console.warn('Failed to parse stream event chunk:', err);
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();

        // Auto-reconnect after 3s
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setConnected(false);
    };
  }, [projectId]);

  const clearEvents = () => setEvents([]);

  return { events, connected, clearEvents };
}
