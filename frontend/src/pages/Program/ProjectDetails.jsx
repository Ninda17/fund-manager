import React from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useParams } from 'react-router-dom'
const ProjectDetails = () => {
  const { id } = useParams()
  return (

    <DashboardLayout>
      <div>Project details</div>
      <div>{ id }</div>
    </DashboardLayout>
  )
}

export default ProjectDetails
