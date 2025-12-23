'use client';

import { useState } from 'react';
import { Card, Container, Heading, Text } from '@/components';

export default function TestStreakPage() {
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStreak = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/streak');
      if (response.ok) {
        const data = await response.json();
        setStreak(data);
        setMessage('Streak fetched successfully!');
      } else {
        const error = await response.text();
        setMessage(`Error: ${error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_type: 'audio_listen' }),
      });

      if (response.ok) {
        const data = await response.json();
        setStreak(data.streak);
        setMessage(data.alreadyLogged ? 'Already logged today!' : 'Activity logged! Streak updated.');
      } else {
        const error = await response.text();
        setMessage(`Error: ${error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-thermal-deep to-thermal-blue">
      <Container maxWidth="md" padding="lg">
        <div className="mb-8">
          <Heading level={1} size="xl" className="text-thermal-yellow thermal-text-glow">
            Test Streak Feature
          </Heading>
          <Text className="mt-2 text-thermal-cyan/80">
            Use this page to test the streak tracking system
          </Text>
        </div>

        <div className="space-y-6">
          {/* Actions Card */}
          <Card variant="outlined" padding="lg">
            <Heading level={3} size="md" className="mb-4">
              Actions
            </Heading>

            <div className="space-y-4">
              <button
                onClick={fetchStreak}
                disabled={loading}
                className="w-full px-4 py-2 bg-thermal-cyan text-thermal-deep font-semibold rounded-md hover:bg-thermal-gold transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Fetch Current Streak'}
              </button>

              <button
                onClick={logActivity}
                disabled={loading}
                className="w-full px-4 py-2 bg-thermal-gold text-thermal-deep font-semibold rounded-md hover:bg-thermal-orange transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Log Activity (Increment Streak)'}
              </button>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-md ${
                message.includes('Error')
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-green-100 text-green-800 border border-green-300'
              }`}>
                {message}
              </div>
            )}
          </Card>

          {/* Streak Data Card */}
          {streak && (
            <Card variant="outlined" padding="lg">
              <Heading level={3} size="md" className="mb-4">
                Streak Data
              </Heading>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <Text className="font-semibold">Current Streak:</Text>
                  <Text className="text-thermal-orange font-bold text-xl">
                    {streak.current_streak} days 🔥
                  </Text>
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <Text className="font-semibold">Longest Streak:</Text>
                  <Text className="text-thermal-gold font-bold">
                    {streak.longest_streak} days
                  </Text>
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <Text className="font-semibold">Total Activities:</Text>
                  <Text>{streak.total_activities}</Text>
                </div>

                <div className="flex justify-between items-center py-2">
                  <Text className="font-semibold">Last Activity:</Text>
                  <Text className="font-mono text-sm">
                    {streak.last_activity_date || 'Never'}
                  </Text>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-100 rounded-md">
                <Text size="sm" className="text-gray-600 font-mono">
                  <pre>{JSON.stringify(streak, null, 2)}</pre>
                </Text>
              </div>
            </Card>
          )}

          {/* Instructions Card */}
          <Card variant="outlined" padding="lg">
            <Heading level={3} size="md" className="mb-4">
              Testing Instructions
            </Heading>

            <div className="space-y-2 text-sm">
              <p><strong>1.</strong> Make sure you've run the database migration first</p>
              <p><strong>2.</strong> Click "Fetch Current Streak" to see your current streak (will be 0 if new)</p>
              <p><strong>3.</strong> Click "Log Activity" to increment your streak</p>
              <p><strong>4.</strong> You can only log once per day - subsequent clicks will say "Already logged today"</p>
              <p><strong>5.</strong> Check the header to see the fire emblem with your streak number</p>
              <p><strong>6.</strong> The fire color changes every week (7 days)</p>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
