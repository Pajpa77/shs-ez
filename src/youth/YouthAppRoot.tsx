import React from 'react';
import { YouthProvider, useYouth } from './YouthContext';
import { YouthSelectionScreen } from './components/YouthSelectionScreen';
import { YouthApp } from './components/YouthApp';
import { User } from '../types';

interface YouthAppRootProps {
  adultUsers: User[];
  onExitYouthModule: () => void;
  onStartTrackingTest?: (user: User, duration: 10 | 20 | 30) => void;
}

const YouthAppInner: React.FC<{
  adultUsers: User[];
  onExitYouthModule: () => void;
  onStartTrackingTest?: (user: User, duration: 10 | 20 | 30) => void;
}> = ({
  adultUsers,
  onExitYouthModule,
  onStartTrackingTest,
}) => {
  const { currentYouthUser } = useYouth();

  if (!currentYouthUser) {
    return (
      <div
        className="fixed inset-0 w-full h-full overflow-y-auto bg-[#000E66] z-[99999]"
        style={{
          backgroundColor: '#000E66',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <YouthSelectionScreen
          adultUsers={adultUsers}
          onExitYouthModule={onExitYouthModule}
          onStartTrackingTest={onStartTrackingTest}
        />
      </div>
    );
  }

  return <YouthApp onExitYouthModule={onExitYouthModule} />;
};

export const YouthAppRoot: React.FC<YouthAppRootProps> = ({
  adultUsers,
  onExitYouthModule,
  onStartTrackingTest,
}) => {
  return (
    <YouthProvider adultUsers={adultUsers}>
      <YouthAppInner
        adultUsers={adultUsers}
        onExitYouthModule={onExitYouthModule}
        onStartTrackingTest={onStartTrackingTest}
      />
    </YouthProvider>
  );
};
