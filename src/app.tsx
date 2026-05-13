import { useMemo, useState, type CSSProperties } from 'react';
import FolderPicker from './components/folder-picker/folder-picker';
import Slideshow from './components/slideshow/slideshow';
import { getConfiguredFolderIds } from './config';
import { getTheme } from './theme';
import type { Folder } from './types';
import styles from './app.module.scss';

export default function App() {
  const configuredFolderIds = useMemo(() => getConfiguredFolderIds(), []);
  const theme = useMemo(() => getTheme(), []);
  const [pickedFolder, setPickedFolder] = useState<Folder | null>(null);
  // Stable array reference per picked-folder id so Slideshow's effect doesn't
  // re-fetch on unrelated App re-renders.
  const pickedFolderIds = useMemo<string[] | null>(
    () => (pickedFolder ? [pickedFolder.id] : null),
    [pickedFolder],
  );

  const themeStyle: CSSProperties = {
    ['--theme-primary' as string]: theme.primary,
    ['--theme-accent' as string]: theme.accent,
  };

  let content: React.ReactNode;

  if (configuredFolderIds) {
    content = (
      <Slideshow
        folderIds={configuredFolderIds}
        label={configuredFolderIds.length === 1 ? 'Slideshow' : `${configuredFolderIds.length} folders`}
        onChangeFolder={null}
      />
    );
  } else if (pickedFolder && pickedFolderIds) {
    content = (
      <Slideshow
        folderIds={pickedFolderIds}
        label={pickedFolder.name}
        onChangeFolder={() => setPickedFolder(null)}
      />
    );
  } else {
    content = <FolderPicker onSelect={setPickedFolder} />;
  }

  return (
    <div className={styles.root} style={themeStyle}>
      {content}
    </div>
  );
}
