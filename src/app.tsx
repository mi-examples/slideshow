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
  } else if (pickedFolder) {
    content = (
      <Slideshow
        folderIds={[pickedFolder.id]}
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
