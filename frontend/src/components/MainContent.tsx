import SQLGenerator from './SQLGenerator'
import SavedRequirements from './SavedRequirements'
import Settings from './Settings'
import Profile from './Profile'

interface MainContentProps {
  selectedPage: string
}

export default function MainContent({ selectedPage }: MainContentProps) {
  switch (selectedPage) {
    case 'Saved Requirements':
      return <SavedRequirements />
    case 'Settings':
      return <Settings />
    case 'Profile':
      return <Profile />
    case 'SQL Query Generator':
    default:
      return <SQLGenerator />
  }
}
