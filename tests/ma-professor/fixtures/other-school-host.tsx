// Local UI host: no authentication, licence or backup services are mounted.
import React from 'react'
import { createRoot } from 'react-dom/client'
import Bootstrap from '../../../src/components/ma-professor/calendar/InitialSchoolCalendarBootstrap'
import App from '../../../src/components/ma-professor/MAProfessorApp'
import { maProfessorDb } from '../../../src/components/ma-professor/db'
import { maProfessorRepository } from '../../../src/components/ma-professor/repository'
import '../../../src/index.css'
Object.assign(window, {__trialDb: maProfessorDb, __trialRepository: maProfessorRepository})
createRoot(document.getElementById('root')!).render(
  <Bootstrap><div className="ma-professor-product"><App /></div></Bootstrap>
)
