import { getEntityIdFromKeys } from "@dojoengine/utils";
import { v4 as uuidv4 } from "uuid";
import { useAccount } from "@starknet-react/core";
import { useDojoSDK } from "@dojoengine/sdk/react";
import { CairoCustomEnum } from "starknet";

/**
 * Custom hook to handle system calls and state management in the Dojo application.
 * Provides functionality for creating a round and handling optimistic updates.
 */
export const useSystemCalls = () => {
	const { account } = useAccount();
	const { useDojoStore, client } = useDojoSDK();
	const state = useDojoStore((state) => state);
  
	const generateEntityId = () => {
	  if (!account) throw new Error("Account not available");
	  return getEntityIdFromKeys([BigInt(account.address)]);
	};
  
	const createRound = async (genre: CairoCustomEnum): Promise<bigint> => {
		if (!account) throw new Error("Account not available");
		const transactionId = uuidv4();
	  
		try {
			console.log('[CreateRound] Starting round creation...');
			
			// 1. Execute the create round transaction
			const txResult = await client.actions.createRound(account, genre);
			console.log('[CreateRound] Transaction result:', txResult);
			
			// 2. Wait for transaction to be confirmed (give some time for mining)
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			// 3. Get the actual round ID from the contract using getRoundId
			console.log('[CreateRound] Fetching round ID from contract...');
			const roundIdResult = await client.actions.getRoundId();
			console.log('[CreateRound] Round ID result:', roundIdResult);
			
			// 4. Extract the actual round ID
			const actualRoundId = BigInt(roundIdResult[0] || roundIdResult.toString());
			console.log('[CreateRound] Actual round ID:', actualRoundId.toString());
			
			// 5. Update optimistic state with real ID
			state.applyOptimisticUpdate(transactionId, (draft: any) => {
				// Use Dojo's entity ID format to match network storage (Torii)
				const roundsEntityId = getEntityIdFromKeys([actualRoundId]);
				if (!draft.entities[roundsEntityId]) {
					draft.entities[roundsEntityId] = {
						entityId: roundsEntityId,
						models: {
							lyricsflip: {
								Rounds: {
									round_id: actualRoundId,
									round: {
										creator: account?.address || "",
										genre: genre.activeVariant(), 
										wager_amount: 0,
										start_time: BigInt(Date.now()),
										state: 0, // WAITING state
										end_time: 0,
										next_card_index: 0,
										players_count: 1, // Creator joins automatically
										ready_players_count: 0,
									}
								},
							},
						},
					};
				}
				
				// Create the RoundCreated event entity
				const eventEntityId = getEntityIdFromKeys([actualRoundId, BigInt(Date.now())]);
				if (!draft.entities[eventEntityId]) {
					draft.entities[eventEntityId] = {
						entityId: eventEntityId,
						models: {
							lyricsflip: {
								RoundCreated: {
									round_id: actualRoundId,
									creator: account?.address || "",
								},
							},
						},
					};
				}
			});
			
			return actualRoundId; // Return the real round ID!
			
		} catch (error) {
			state.revertOptimisticUpdate(transactionId);
			console.error("Error creating round:", error);
			throw error;
		} finally {
			state.confirmTransaction(transactionId);
		}
	};

	const joinRound = async (roundId: bigint) => {
		if (!account) throw new Error("Account not available");
		const transactionId = uuidv4();
		const entityId = generateEntityId();

		console.log(`[JoinRound] Starting join operation for round ${roundId}`, {
			roundId: roundId.toString(),
			roundIdHex: `0x${roundId.toString(16)}`,
			accountAddress: account.address
		});
		
		// Apply optimistic update
		state.applyOptimisticUpdate(transactionId, (draft: any) => {
			if (!draft.entities[entityId]) {
				draft.entities[entityId] = {
					entityId,
					models: {
						lyricsflip: {
							RoundPlayer: {
								player_to_round_id: [account.address, roundId],
								joined: true,
								ready_state: false,
							},
						},
					},
				};
			}
		});

		try {
			console.log(`[JoinRound] Executing join transaction for round ${roundId}`, {
				roundId: roundId.toString(),
				roundIdHex: `0x${roundId.toString(16)}`,
				accountAddress: account.address
			});
			await client.actions.joinRound(account, roundId);
			console.log(`[JoinRound] Successfully joined round ${roundId}`);
		} catch (error) {
			console.error(`[JoinRound] Error joining round ${roundId}:`, {
				error,
				roundId: roundId.toString(),
				roundIdHex: `0x${roundId.toString(16)}`,
				accountAddress: account.address
			});
			state.revertOptimisticUpdate(transactionId);
			throw error;
		} finally {
			state.confirmTransaction(transactionId);
		}
	};

	const startRound = async (roundId: bigint): Promise<void> => {
		if (!account) throw new Error("Account not available");
		const transactionId = uuidv4();

		console.log(`[StartRound] Starting round ${roundId}`, {
			roundId: roundId.toString(),
			roundIdHex: `0x${roundId.toString(16)}`,
			accountAddress: account.address
		});

		// Apply optimistic update
		state.applyOptimisticUpdate(transactionId, (draft: any) => {
			// Use Dojo's entity ID format to match network storage
			const roundsEntityId = getEntityIdFromKeys([roundId]);
			const existingRound = draft.entities[roundsEntityId];
			
			if (existingRound?.models?.lyricsflip?.Rounds) {
				existingRound.models.lyricsflip.Rounds.round.state = 1; // STARTED state
				existingRound.models.lyricsflip.Rounds.round.start_time = BigInt(Date.now());
			}
		});

		try {
			console.log(`[StartRound] Executing start transaction for round ${roundId}`);
			await client.actions.startRound(account, roundId);
			console.log(`[StartRound] Successfully started round ${roundId}`);
		} catch (error) {
			console.error(`[StartRound] Error starting round ${roundId}:`, error);
			state.revertOptimisticUpdate(transactionId);
			throw error;
		} finally {
			state.confirmTransaction(transactionId);
		}
	};
  
	return {
		createRound,
		joinRound,
		startRound,
	};
}; 