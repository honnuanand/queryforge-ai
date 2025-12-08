import SQLGenerator from './SQLGenerator'
import SavedRequirements from './SavedRequirements'
import Settings from './Settings'

interface MainContentProps {
  selectedPage: string
}

export default function MainContent({ selectedPage }: MainContentProps) {
  switch (selectedPage) {
    case 'Saved Requirements':
      return <SavedRequirements />
    case 'Settings':
      return <Settings />
    case 'SQL Query Generator':
    default:
      return <SQLGenerator />
  }
}
