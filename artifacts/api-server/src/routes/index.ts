import { Router, type IRouter } from "express";
import healthRouter from "./health";
import platformRouter from "./platform";
import ehrRouter from "./ehr";
import consentRouter from "./consent";
import accessRouter from "./access";
import recordsRouter from "./records";
import questionnairesRouter from "./questionnaires";
import intakeRouter from "./intake";
import clinicianOperationsRouter from "./clinician-operations";
import clinicalWorkstationRouter from "./clinical-workstation";
import workQueueRouter from "./work-queue";
import authRouter from "./auth";
import patientRouter from "./patient";
import { createSliceProductionRouter } from "./slice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(platformRouter);
router.use(ehrRouter);
router.use(consentRouter);
router.use(accessRouter);
router.use(recordsRouter);
router.use(questionnairesRouter);
router.use(intakeRouter);
router.use(clinicianOperationsRouter);
router.use(clinicalWorkstationRouter);
router.use(workQueueRouter);
router.use(authRouter);
router.use(patientRouter);
router.use(createSliceProductionRouter());

export default router;
