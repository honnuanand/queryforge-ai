import SQLGenerator from './SQLGenerator'

interface MainContentProps {
  selectedPage: string
}

export default function MainContent({ selectedPage }: MainContentProps) {
  // Single Table is now the only page
  return <SQLGenerator />
}
