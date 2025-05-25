'use client';

import { useState, useEffect } from 'react';
import { useModalStore } from '@/store/modal-store';
import { Button } from '../atoms/button';
import { Input } from '../atoms/input';
import { Card, CardContent } from '../atoms/card';
import { useJoinRound } from '@/lib/dojo/hooks/useJoinRound';
import { useRoundQuery } from '@/lib/dojo/hooks/useRoundQuery';
import { Loader2, AlertCircle } from 'lucide-react';
import { BigNumberish } from 'starknet';

export const ChallengeModal = () => {
  const { closeModal } = useModalStore();
  const [code, setCode] = useState('');
  const [roundId, setRoundId] = useState<bigint | null>(null);
  const { validateRoundId, joinRound, isLoading: isJoining } = useJoinRound();
  const { queryRound, round, isPlayer, playersCount, isLoading: isLoadingRound, error } = useRoundQuery();

  const isLoading = isJoining || isLoadingRound;

  const handleCodeChange = (value: string) => {
    setCode(value);
    
    // Parse and set roundId for validation, but don't query yet
    const validationResult = validateRoundId(value.trim());
    if (validationResult.isValid) {
      try {
        const id = value.startsWith('0x') ? BigInt(value) : BigInt(value);
        setRoundId(id);
        console.log('[ChallengeModal] Set round ID:', id.toString());
      } catch (e) {
        console.error('[ChallengeModal] Error converting round ID:', e);
        setRoundId(null);
      }
    } else {
      setRoundId(null);
    }
  };

  const handleQuery = async () => {
    if (!roundId) return;
    
    console.log('[ChallengeModal] Querying round:', roundId.toString());
    await queryRound(roundId);
  };

  const handleJoin = async () => {
    if (!roundId) return;
    
    try {
      console.log('[ChallengeModal] Attempting to join round:', roundId.toString());
      await joinRound(roundId);
      closeModal();
    } catch (error) {
      console.error('[ChallengeModal] Failed to join round:', error);
    }
  };

  const formatWagerAmount = (amount: BigNumberish) => {
    return Number(BigInt(amount.toString())) / 1e18;
  };

  const calculatePayout = (wagerAmount: BigNumberish, maxPlayers: number = 6) => {
    return (Number(BigInt(wagerAmount.toString())) * maxPlayers) / 1e18;
  };

  const getRoundStatus = (state: BigNumberish) => {
    switch (Number(BigInt(state.toString()))) {
      case 0:
        return { text: 'Waiting for players', color: 'text-green-500' };
      case 1:
        return { text: 'In progress', color: 'text-yellow-500' };
      case 2:
        return { text: 'Ended', color: 'text-red-500' };
      default:
        return { text: 'Unknown', color: 'text-gray-500' };
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Input
        placeholder="Enter Challenge Code"
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        disabled={isLoading}
      />
      
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      {isLoadingRound && code.trim() && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading round data...</span>
        </div>
      )}
      
      {round && !isLoadingRound && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Wager Amount:</span>
                <p className="font-semibold">{formatWagerAmount(round.round.wager_amount)} STRK</p>
              </div>
              
              <div>
                <span className="text-gray-600">Participants:</span>
                <p className="font-semibold">{playersCount}/6</p>
              </div>
              
              <div>
                <span className="text-gray-600">Payout if Won:</span>
                <p className="font-semibold text-purple-600">
                  {calculatePayout(round.round.wager_amount)} STRK
                </p>
              </div>
              
              <div>
                <span className="text-gray-600">Creator:</span>
                <p className="font-semibold font-mono text-xs">
                  {round.round.creator.slice(0, 6)}...{round.round.creator.slice(-4)}
                </p>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <span className="text-gray-600">Status: </span>
              <span className={`font-semibold ${getRoundStatus(round.round.state).color}`}>
                {getRoundStatus(round.round.state).text}
              </span>
            </div>
            
            {isPlayer && (
              <div className="text-green-600 text-sm font-medium bg-green-50 p-2 rounded-md">
                ✓ You have joined this round
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={closeModal} disabled={isLoading}>
          Cancel
        </Button>
        
        {!round && roundId ? (
          <Button 
            onClick={handleQuery} 
            disabled={isLoading || !roundId}
          >
            {isLoadingRound ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Challenge'
            )}
          </Button>
        ) : round ? (
          <Button 
            onClick={handleJoin} 
            disabled={isLoading || isPlayer || Number(BigInt(round.round.state?.toString() || '0')) !== 0}
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : isPlayer ? (
              'Already Joined'
            ) : Number(BigInt(round.round.state?.toString() || '0')) !== 0 ? (
              'Round Not Available'
            ) : (
              'Join Challenge'
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}