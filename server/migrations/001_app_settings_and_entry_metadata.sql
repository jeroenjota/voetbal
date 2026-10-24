-- Additive changes only: the VBPool2 (VB6) program keeps working with these tables.
CREATE TABLE IF NOT EXISTS `tblAppSettings` (
  `settingKey` varchar(64) NOT NULL,
  `settingValue` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `tblCompetitorPools`
  ADD COLUMN IF NOT EXISTS `payedTo` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `entrySource` varchar(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `createdAt` datetime DEFAULT NULL;
