'use client';

import { PasteWorkoutBox } from '@/components/home/PasteWorkoutBox';
import { ComingUpList } from '@/components/home/ComingUpList';
import { RecentWorkoutsList } from '@/components/home/RecentWorkoutsList';
import { CommandInput } from '@/components/home/CommandInput';
import { RecoveryPrompt } from '@/components/workout-run/RecoveryPrompt';
import { useActiveWorkoutRecovery } from '@/hooks/useActiveWorkoutRecovery';

export default function HomePage() {
  const { recovery, discard } = useActiveWorkoutRecovery();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Workout Caller</h1>
      {recovery && <RecoveryPrompt recovery={recovery} onDiscard={discard} />}
      <PasteWorkoutBox />
      <CommandInput />
      <ComingUpList />
      <RecentWorkoutsList />
    </div>
  );
}
