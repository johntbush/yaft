ALTER TABLE YAFT_DISCUSSION ADD COLUMN ALLOW_ANONYMOUS BOOL AFTER MESSAGE_COUNT;
ALTER TABLE YAFT_MESSAGE ADD COLUMN ANONYMOUS BOOL AFTER CREATOR_ID;
