import SQLGenerator from './SQLGenerator'
import SavedRequirements from './SavedRequirements'

interface MainContentProps {
  selectedPage: string
}

export default function MainContent({ selectedPage }: MainContentProps) {
  switch (selectedPage) {
    case 'Saved Requirements':
      return <SavedRequirements />
    case 'SQL Query Generator':
    default:
      return <SQLGenerator />
  }
}
